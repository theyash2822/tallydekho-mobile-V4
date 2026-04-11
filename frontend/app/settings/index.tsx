import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { MOCK_USER } from '../../src/data/mockData';

type SectionId = 'account' | 'preferences' | 'notifications' | 'integrations' | 'contact';

interface SubItem {
  id: string;
  label: string;
  icon: string;
  route?: string;
  badge?: string;
  badgeColor?: string;
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
      { id: 'license', label: 'License & Credits', icon: 'card-outline', route: '/settings/license', badge: 'Free', badgeColor: '#2D7D46' },
    ],
  },
  {
    id: 'preferences', title: 'Preferences',
    icon: 'options-outline', iconColor: '#2563EB', iconBg: '#EFF6FF',
    subItems: [
      { id: 'language', label: 'Language & Region', icon: 'language-outline' },
      { id: 'currency', label: 'Currency & Number Format', icon: 'cash-outline' },
      { id: 'voucher', label: 'Voucher Configuration', icon: 'document-text-outline' },
    ],
  },
  {
    id: 'notifications', title: 'Notifications',
    icon: 'notifications-outline', iconColor: '#D97706', iconBg: '#FFFBEB',
    subItems: [
      { id: 'channels', label: 'Channels & Quiet Hours', icon: 'volume-medium-outline' },
      { id: 'stock_alerts', label: 'Low Stock & Expiry Alerts', icon: 'alert-circle-outline' },
      { id: 'compliance', label: 'Compliance Reminders', icon: 'shield-checkmark-outline' },
      { id: 'payments', label: 'Payment Reminders', icon: 'card-outline' },
    ],
  },
  {
    id: 'integrations', title: 'Integrations',
    icon: 'git-network-outline', iconColor: '#0891B2', iconBg: '#ECFEFF',
    subItems: [
      { id: 'tally', label: 'Tally ERP Sync', icon: 'sync-outline', badge: 'Paired', badgeColor: '#2D7D46' },
      { id: 'bank', label: 'Bank Feeds', icon: 'wallet-outline' },
      { id: 'ewaybill', label: 'E-Way Bill', icon: 'document-outline' },
      { id: 'einvoice', label: 'E-Invoice (IRN)', icon: 'receipt-outline' },
    ],
  },
  {
    id: 'contact', title: 'Contact & Information',
    icon: 'information-circle-outline', iconColor: '#6B7280', iconBg: '#F3F4F6',
    subItems: [
      { id: 'about', label: 'About & Version', icon: 'phone-portrait-outline' },
      { id: 'security', label: 'Data Security', icon: 'lock-closed-outline' },
      { id: 'help', label: 'Help Center', icon: 'help-circle-outline' },
    ],
  },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [expanded, setExpanded] = useState<SectionId | null>('account');

  const toggle = (id: SectionId) => setExpanded(prev => prev === id ? null : id);

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Profile mini card */}
        <TouchableOpacity style={styles.profileCard} onPress={() => {}} activeOpacity={0.8}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLargeText}>{MOCK_USER.name[0]}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{MOCK_USER.name}</Text>
            <Text style={styles.profilePhone}>{MOCK_USER.phone}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} />
        </TouchableOpacity>

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
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  <Ionicons
                    name={isOpen ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={isOpen ? COLORS.brandPrimary : COLORS.textTertiary}
                  />
                </TouchableOpacity>

                {/* Sub-items */}
                {isOpen && (
                  <View style={styles.subItems}>
                    {section.subItems.map((sub, idx) => (
                      <TouchableOpacity
                        key={sub.id}
                        style={[styles.subItem, idx < section.subItems.length - 1 && styles.subItemBorder]}
                        onPress={() => sub.route ? router.push(sub.route as any) : {}}
                        activeOpacity={0.75}
                      >
                        <View style={styles.subLeft}>
                          <View style={styles.subIconBox}>
                            <Ionicons name={sub.icon as any} size={16} color={COLORS.textSecondary} />
                          </View>
                          <Text style={styles.subLabel}>{sub.label}</Text>
                        </View>
                        <View style={styles.subRight}>
                          {sub.badge && (
                            <View style={[styles.badge, { backgroundColor: sub.badgeColor + '20' }]}>
                              <Text style={[styles.badgeText, { color: sub.badgeColor }]}>{sub.badge}</Text>
                            </View>
                          )}
                          <Ionicons name="chevron-forward" size={14} color={COLORS.textTertiary} />
                        </View>
                      </TouchableOpacity>
                    ))}
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
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <View style={{ height: 30 }} />
      </ScrollView>
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
