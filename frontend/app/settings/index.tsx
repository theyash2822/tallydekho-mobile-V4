import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, Animated, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { safePush } from '../../src/utils/safeNavigation';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { useSettings } from '../../src/context/SettingsContext';
import { useWorkspace } from '../../src/context/WorkspaceContext';

type SectionId = 'account' | 'preferences' | 'notifications' | 'integrations' | 'contact';

interface SubItem {
  id: string;
  label: string;
  icon: string;
  route?: string;
  badge?: string;
  badgeColor?: string;
  /** If set, renders a Switch instead of chevron; value stored in AsyncStorage */
  toggleKey?: string;
  toggleDefault?: boolean;
}

interface Section {
  id: SectionId;
  title: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  subItems: SubItem[];
}

const SECTIONS: Section[] = [
  {
    id: 'account', title: 'Account & Organization',
    icon: 'person-circle-outline', iconColor: '#7C3AED', iconBg: '#F5F3FF',
    subItems: [
      { id: 'profile', label: 'Profile', icon: 'person-outline', route: '/settings/profile' },
      { id: 'company', label: 'Company Information', icon: 'business-outline', route: '/settings/company' },
      { id: 'license', label: 'License & Credits', icon: 'card-outline', route: '/settings/license' },
      { id: 'approvals', label: 'Approvals', icon: 'shield-checkmark-outline', route: '/settings/approvals' },
      { id: 'invitations', label: 'Invitations', icon: 'mail-outline', route: '/settings/invitations' },
    ],
  },
  {
    id: 'preferences', title: 'Preferences',
    icon: 'options-outline', iconColor: '#2563EB', iconBg: '#EFF6FF',
    subItems: [
      { id: 'language', label: 'Language & Region', icon: 'language-outline', route: '/settings/language' },
      { id: 'currency', label: 'Currency & Number Format', icon: 'cash-outline', route: '/settings/currency' },
      { id: 'voucher', label: 'Voucher Configuration', icon: 'document-text-outline', route: '/settings/voucher-config' },
      { id: 'kpi_scroll', label: 'KPI Auto-Scroll', icon: 'play-circle-outline', toggleKey: 'kpi_autoscroll', toggleDefault: true },
    ],
  },
  {
    id: 'notifications', title: 'Notifications',
    icon: 'notifications-outline', iconColor: '#D97706', iconBg: '#FFFBEB',
    subItems: [
      { id: 'channels', label: 'Channels & Quiet Hours', icon: 'volume-medium-outline', route: '/settings/notification-channels' },
      { id: 'stock_alerts', label: 'Low Stock & Expiry Alerts', icon: 'alert-circle-outline', route: '/settings/stock-alerts' },
      { id: 'compliance', label: 'Compliance Reminders', icon: 'shield-checkmark-outline', route: '/settings/compliance-reminders' },
      { id: 'payments', label: 'Payment Reminders', icon: 'card-outline', route: '/settings/payment-reminders' },
    ],
  },
  {
    id: 'integrations', title: 'Integrations',
    icon: 'git-network-outline', iconColor: '#0891B2', iconBg: '#ECFEFF',
    subItems: [
      { id: 'tally', label: 'Tally ERP Sync', icon: 'sync-outline', route: '/settings/tally-sync', badge: '__TALLY_STATUS__', badgeColor: '__TALLY_COLOR__' },
      { id: 'bank', label: 'Bank Feeds', icon: 'wallet-outline', route: '/settings/bank-feeds' },
      { id: 'ewaybill', label: 'E-Way Bill Integration', icon: 'document-outline', route: '/settings/ewb' },
      { id: 'einvoice', label: 'E-Invoice (IRN)', icon: 'receipt-outline', route: '/settings/einvoice' },
    ],
  },
  {
    id: 'contact', title: 'Contact & Information',
    icon: 'information-circle-outline', iconColor: '#6B7280', iconBg: '#F3F4F6',
    subItems: [
      { id: 'about', label: 'About & Version', icon: 'phone-portrait-outline', route: '/settings/about' },
      { id: 'guide', label: 'App Guide', icon: 'compass-outline', route: '/onboarding?replay=true' },
      { id: 'security', label: 'Data Security', icon: 'lock-closed-outline', route: '/settings/security' },
      { id: 'help', label: 'Help Center', icon: 'help-circle-outline', route: '/settings/help' },
    ],
  },
];

// ── Sub-item translation key map ─────────────────────────────────────────────
const SUBITEM_KEY: Record<string, string> = {
  profile:      'settings.profile',
  company:      'settings.companyInfo',
  license:      'settings.license',
  approvals:    'settings.approvals',
  invitations:  'settings.invitations',
  language:     'settings.language',
  currency:     'settings.currency',
  voucher:      'settings.voucher',
  kpi_scroll:   'settings.kpiScroll',
  channels:     'settings.notificationChannels',
  stock_alerts: 'settings.stockAlerts',
  compliance:   'settings.complianceReminders',
  payments:     'settings.paymentReminders',
  tally:        'settings.tallySync',
  bank:         'settings.bankFeeds',
  ewaybill:     'settings.ewayBill',
  einvoice:     'settings.eInvoice',
  about:        'settings.about',
  guide:        'settings.appGuide',
  security:     'settings.security',
  help:         'settings.help',
};

// ── Logout Confirm Bottom Sheet ───────────────────────────────────────────────
function LogoutConfirmSheet({
  visible,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const slideY = useRef(new Animated.Value(300)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
        Animated.timing(opacity, { toValue: 1, useNativeDriver: true, duration: 200 }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideY, { toValue: 300, useNativeDriver: true, duration: 220 }),
        Animated.timing(opacity, { toValue: 0, useNativeDriver: true, duration: 180 }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[ls.overlay, { opacity }]}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <Animated.View style={[ls.sheet, { transform: [{ translateY: slideY }] }]}>
          <View style={ls.handle} />
          {/* Icon */}
          <View style={ls.iconWrap}>
            <View style={ls.iconCircle}>
              <Ionicons name="log-out-outline" size={28} color="#E53935" />
            </View>
          </View>
          <Text style={ls.title}>{t('auth.logout')}</Text>
          <Text style={ls.sub}>{t('auth.logoutConfirm')}</Text>
          {/* Log Out (destructive) */}
          <TouchableOpacity style={ls.logoutBtn} onPress={onConfirm} activeOpacity={0.85}>
            <Ionicons name="log-out-outline" size={16} color="#fff" />
            <Text style={ls.logoutBtnTxt}>{t('auth.logout')}</Text>
          </TouchableOpacity>
          {/* Cancel */}
          <TouchableOpacity style={ls.cancelBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={ls.cancelBtnTxt}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <View style={{ height: 16 }} />
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const ls = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB',
    alignSelf: 'center', marginBottom: 20,
  },
  iconWrap:   { alignItems: 'center', marginBottom: 14 },
  iconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#FEF2F2',
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    fontSize: 18, fontWeight: '800', color: '#1A1A1A',
    textAlign: 'center', marginBottom: 8,
  },
  sub: {
    fontSize: 13, color: '#6B7280',
    textAlign: 'center', lineHeight: 20, marginBottom: 24,
  },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#E53935',
    borderRadius: 12, paddingVertical: 15, marginBottom: 10,
  },
  logoutBtnTxt: { fontSize: 15, fontWeight: '800', color: '#fff' },
  cancelBtn: {
    alignItems: 'center', paddingVertical: 14,
    backgroundColor: '#F3F4F6', borderRadius: 12,
  },
  cancelBtnTxt: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
});

export default function SettingsScreen() {
  const router = useRouter();
  const { signOut, user, company, isPaired } = useAuth();
  const { settings, updateSettings } = useSettings();
  const {
    workspaces,
    workspace,
    workspaceId,
    switchWorkspace,
    demoMode,
    pairingStatus,
    invitations,
  } = useWorkspace();
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<SectionId | null>('account');
  const [showLogoutSheet, setShowLogoutSheet] = useState(false);
  const [showWorkspacePicker, setShowWorkspacePicker] = useState(false);
  // Stores all toggle values keyed by toggleKey
  const [toggles, setToggles] = useState<Record<string, boolean>>({});

  // Load all toggle defaults + persisted values from AsyncStorage on mount
  useEffect(() => {
    const keys: { key: string; def: boolean }[] = [];
    SECTIONS.forEach(s => s.subItems.forEach(item => {
      if (item.toggleKey) keys.push({ key: item.toggleKey, def: item.toggleDefault ?? true });
    }));
    Promise.all(keys.map(({ key, def }) =>
      AsyncStorage.getItem(key).then(val => ({ key, value: val === null ? def : val !== 'false' }))
    )).then(results => {
      const map: Record<string, boolean> = {};
      results.forEach(r => { map[r.key] = r.value; });
      setToggles(map);
    });
  }, []);

  const toggle = (id: SectionId) => setExpanded(prev => prev === id ? null : id);
  const handleLogout = () => setShowLogoutSheet(true);

  const handleToggle = (toggleKey: string, value: boolean) => {
    if (toggleKey === 'kpi_autoscroll') {
      updateSettings({ kpi_autoscroll: value });
    } else {
      setToggles(prev => ({ ...prev, [toggleKey]: value }));
      AsyncStorage.setItem(toggleKey, String(value));
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('settings.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Profile mini card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLargeText}>{(user?.name || 'U')[0]}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name || t('common.yourName')}</Text>
            <Text style={styles.profilePhone}>{user?.phone || ''}</Text>
            {/* Workspace picker — under Name/phone per Mobile handoff */}
            <TouchableOpacity
              style={styles.workspaceRow}
              onPress={() => setShowWorkspacePicker(true)}
              activeOpacity={0.75}
            >
              <Ionicons name="briefcase-outline" size={14} color={COLORS.brandPrimary} />
              <Text style={styles.workspaceName} numberOfLines={1}>
                {workspace?.name || 'Workspace'}
              </Text>
              <Ionicons name="chevron-down" size={14} color={COLORS.textTertiary} />
            </TouchableOpacity>
            {demoMode ? (
              <Text style={styles.demoHint}>Demo Mode · Tally {pairingStatus === 'UNPAIRED' ? 'not paired' : 'reconnecting'}</Text>
            ) : null}
            {invitations.length > 0 ? (
              <TouchableOpacity onPress={() => safePush(router, '/settings/invitations' as any)}>
                <Text style={styles.inviteHint}>{invitations.length} pending invitation{invitations.length > 1 ? 's' : ''}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Accordion sections */}
        <View style={styles.accordionContainer}>
          {SECTIONS.map((section, sIdx) => {
            const isOpen = expanded === section.id;
            return (
              <View key={section.id} style={[styles.sectionWrapper, sIdx > 0 && styles.sectionBorder]}>
                {/* Section header */}
                <TouchableOpacity
                  style={styles.sectionHeader}
                  onPress={() => toggle(section.id)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.sectionIcon, { backgroundColor: section.iconBg }]}>
                    <Ionicons name={section.icon as any} size={18} color={section.iconColor} />
                  </View>
                  <Text style={styles.sectionTitle}>{t('settings.' + section.id)}</Text>
                  <Ionicons
                    name={isOpen ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={isOpen ? COLORS.brandPrimary : COLORS.textTertiary}
                  />
                </TouchableOpacity>

                {/* Sub-items */}
                {isOpen && (
                  <View style={styles.subItems}>
                    {section.subItems.map((sub, idx) => {
                      const isToggleItem = !!sub.toggleKey;
                      const toggleVal = sub.toggleKey === 'kpi_autoscroll'
                        ? settings.kpi_autoscroll
                        : (sub.toggleKey ? (toggles[sub.toggleKey] ?? sub.toggleDefault ?? true) : false);
                      return (
                        <TouchableOpacity
                          key={sub.id}
                          style={[styles.subItem, idx < section.subItems.length - 1 && styles.subItemBorder]}
                          onPress={() => {
                            if (isToggleItem && sub.toggleKey) handleToggle(sub.toggleKey, !toggleVal);
                            else if (sub.route) safePush(router, sub.route as any);
                          }}
                          activeOpacity={isToggleItem ? 1 : 0.75}
                        >
                          <View style={styles.subLeft}>
                            <View style={styles.subIconBox}>
                              <Ionicons name={sub.icon as any} size={16} color={COLORS.textSecondary} />
                            </View>
                            <Text style={styles.subLabel}>{t(SUBITEM_KEY[sub.id] || sub.label)}</Text>
                          </View>
                          <View style={styles.subRight}>
                            {sub.badge && (() => {
                              // Resolve dynamic tally status badge
                              const badgeText  = sub.badge === '__TALLY_STATUS__'
                                ? (isPaired ? 'Paired' : 'Unpaired')
                                : sub.badge;
                              const badgeColor = sub.badgeColor === '__TALLY_COLOR__'
                                ? (isPaired ? '#2D7D46' : '#C0392B')
                                : (sub.badgeColor ?? '#2D7D46');
                              return (
                                <View style={[styles.badge, { backgroundColor: badgeColor + '20' }]}>
                                  <Text style={[styles.badgeText, { color: badgeColor }]}>{badgeText}</Text>
                                </View>
                              );
                            })()}
                            {isToggleItem ? (
                              <Switch
                                value={toggleVal}
                                onValueChange={v => { if (sub.toggleKey) handleToggle(sub.toggleKey, v); }}
                                trackColor={{ false: COLORS.borderStrong, true: COLORS.brandPrimary }}
                                thumbColor={COLORS.white}
                                style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
                              />
                            ) : (
                              <Ionicons name="chevron-forward" size={14} color={COLORS.textTertiary} />
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.madeInIndia}>🇮🇳 Made in India with Love</Text>
          <Text style={styles.version}>TallyDekho v3.7.2 · Build 257</Text>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color='#E53935' />
          <Text style={styles.logoutText}>{t('auth.logout')}</Text>
        </TouchableOpacity>

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* Custom Logout Confirmation Sheet */}
      <LogoutConfirmSheet
        visible={showLogoutSheet}
        onClose={() => setShowLogoutSheet(false)}
        onConfirm={() => { setShowLogoutSheet(false); signOut(); }}
      />

      <Modal visible={showWorkspacePicker} transparent animationType="slide" onRequestClose={() => setShowWorkspacePicker(false)}>
        <TouchableOpacity style={styles.wsOverlay} activeOpacity={1} onPress={() => setShowWorkspacePicker(false)}>
          <View style={styles.wsSheet}>
            <Text style={styles.wsTitle}>Switch Workspace</Text>
            {workspaces.map((w) => {
              const selected = w.id === workspaceId;
              return (
                <TouchableOpacity
                  key={w.id}
                  style={[styles.wsItem, selected && styles.wsItemSelected]}
                  onPress={async () => {
                    setShowWorkspacePicker(false);
                    if (w.id !== workspaceId) await switchWorkspace(w.id);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.wsItemName}>{w.name}</Text>
                    <Text style={styles.wsItemMeta}>
                      {(w.membershipType || 'MEMBER')}
                      {w.tallyConnection ? ` · ${w.tallyConnection}` : ''}
                    </Text>
                  </View>
                  {selected ? <Ionicons name="checkmark-circle" size={20} color={COLORS.brandPrimary} /> : null}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={styles.wsCancel} onPress={() => setShowWorkspacePicker(false)}>
              <Text style={styles.wsCancelTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm, paddingVertical: 10,
    backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary },
  scroll: { flex: 1 },

  // Profile card
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: COLORS.cardBg, margin: SPACING.md,
    borderRadius: RADIUS.lg, padding: 16,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  avatarLarge: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center',
  },
  avatarLargeText: { fontSize: TYPOGRAPHY.lg, fontWeight: '800', color: COLORS.white },
  profileInfo: { flex: 1 },
  profileName:  { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  profilePhone: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, marginTop: 2 },
  workspaceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8,
    paddingVertical: 4,
  },
  workspaceName: { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.brandPrimary },
  demoHint: { fontSize: 11, color: '#D97706', marginTop: 4, fontWeight: '600' },
  inviteHint: { fontSize: 11, color: COLORS.brandPrimary, marginTop: 4, fontWeight: '600' },
  wsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  wsSheet: {
    backgroundColor: COLORS.cardBg, borderTopLeftRadius: 16, borderTopRightRadius: 16,
    padding: 20, paddingBottom: 32, maxHeight: '70%',
  },
  wsTitle: { fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  wsItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  wsItemSelected: { backgroundColor: COLORS.pageBg, marginHorizontal: -8, paddingHorizontal: 8, borderRadius: 8 },
  wsItemName: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textPrimary },
  wsItemMeta: { fontSize: 11, color: COLORS.textTertiary, marginTop: 2 },
  wsCancel: { marginTop: 16, alignItems: 'center', paddingVertical: 12, backgroundColor: COLORS.pageBg, borderRadius: 12 },
  wsCancelTxt: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },

  // Accordion
  accordionContainer: {
    marginHorizontal: SPACING.md,
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    overflow: 'hidden',
  },
  sectionWrapper: {},
  sectionBorder:  { borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 16,
  },
  sectionIcon:  { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textPrimary },

  // Sub-items
  subItems: { backgroundColor: COLORS.pageBg },
  subItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  subItemBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  subLeft:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  subIconBox: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  subLabel: { fontSize: TYPOGRAPHY.sm, fontWeight: '500', color: COLORS.textPrimary },
  subRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  // Footer
  footer: { alignItems: 'center', paddingVertical: 20, gap: 4 },
  madeInIndia: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '500' },
  version:     { fontSize: 11, color: COLORS.textTertiary },

  // Logout
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: SPACING.md, paddingVertical: 14,
    backgroundColor: '#FEF2F2', borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: '#FCA5A5',
  },
  logoutText: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: '#E53935' },
});
