import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

// ── Section Header ────────────────────────────────────────────────────────
function SectionHeader({ icon, title, color, bg }: {
  icon: string; title: string; color: string; bg: string;
}) {
  return (
    <View style={s.secHeader}>
      <View style={[s.secIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon as any} size={15} color={color} />
      </View>
      <Text style={s.secTitle}>{title}</Text>
    </View>
  );
}

// ── Toggle Row ────────────────────────────────────────────────────────────
function ToggleRow({ icon, label, sub, value, onChange, iconBg }: {
  icon: string; label: string; sub?: string; value: boolean;
  onChange: (v: boolean) => void; iconBg?: string;
}) {
  return (
    <View style={s.toggleRow}>
      <View style={s.toggleLeft}>
        <View style={[s.rowIcon, iconBg ? { backgroundColor: iconBg } : {}]}>
          <Ionicons name={icon as any} size={16} color={COLORS.textSecondary} />
        </View>
        <View style={s.toggleText}>
          <Text style={s.rowLabel}>{label}</Text>
          {sub && <Text style={s.rowSub}>{sub}</Text>}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: COLORS.borderDefault, true: COLORS.brandPrimary }}
        thumbColor={COLORS.white}
      />
    </View>
  );
}

// ── Action Row ────────────────────────────────────────────────────────────
function ActionRow({ icon, label, sub, badge, badgeColor, onPress, danger }: {
  icon: string; label: string; sub?: string; badge?: string;
  badgeColor?: string; onPress: () => void; danger?: boolean;
}) {
  return (
    <TouchableOpacity style={s.actionRow} onPress={onPress} activeOpacity={0.7}>
      <View style={s.toggleLeft}>
        <View style={[s.rowIcon, danger && { backgroundColor: '#FEF2F2' }]}>
          <Ionicons name={icon as any} size={16} color={danger ? '#E53935' : COLORS.textSecondary} />
        </View>
        <View style={s.toggleText}>
          <Text style={[s.rowLabel, danger && { color: '#E53935' }]}>{label}</Text>
          {sub && <Text style={s.rowSub}>{sub}</Text>}
        </View>
      </View>
      <View style={s.actionRight}>
        {badge && (
          <View style={[s.badge, { backgroundColor: (badgeColor || COLORS.info) + '20' }]}>
            <Text style={[s.badgeTxt, { color: badgeColor || COLORS.info }]}>{badge}</Text>
          </View>
        )}
        {!danger && <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />}
      </View>
    </TouchableOpacity>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────
export default function SecurityScreen() {
  const router = useRouter();

  const [pinLock, setPinLock]         = useState(true);
  const [biometric, setBiometric]     = useState(true);
  const [sessionTimeout, setSession]  = useState('15m');
  const [twoFactor, setTwoFactor]     = useState(false);
  const [loginAlerts, setLoginAlerts] = useState(true);
  const [dataEncrypt, setEncrypt]     = useState(true);
  const [crashReports, setCrash]      = useState(true);
  const [usageStats, setUsage]        = useState(false);

  const SESSION_OPTS = ['5m', '15m', '30m', '1hr', 'Never'] as const;

  const handleExport = () => {
    Alert.alert(
      'Export Data',
      'Your data will be exported as a CSV file and sent to your registered email address within 24 hours.',
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Export', onPress: () => Alert.alert('✓ Requested', 'Export request submitted. Check your email.') }]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      '⚠️ Delete Account',
      'This action is permanent and cannot be undone. All your data will be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete Permanently', style: 'destructive', onPress: () => Alert.alert('Account Deleted') },
      ]
    );
  };

  const handleChangePin = () => {
    Alert.alert('Change PIN', 'A 6-digit PIN change request has been sent to your registered mobile number.');
  };

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Security & Privacy</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ─── Security Status Banner ─────────────────────────── */}
        <View style={s.statusBanner}>
          <View style={s.statusIconBox}>
            <Ionicons name="shield-checkmark" size={28} color="#2D7D46" />
          </View>
          <View style={s.statusText}>
            <Text style={s.statusTitle}>Your account is protected</Text>
            <Text style={s.statusSub}>PIN lock + biometrics active</Text>
          </View>
          <View style={s.statusBadge}>
            <Text style={s.statusBadgeTxt}>Secure</Text>
          </View>
        </View>

        {/* ─── App Lock ──────────────────────────────────────── */}
        <SectionHeader icon="lock-closed-outline" title="App Lock" color="#7C3AED" bg="#F5F3FF" />
        <View style={s.card}>
          <ToggleRow
            icon="keypad-outline" label="PIN Lock" sub="Require 6-digit PIN on app open"
            value={pinLock} onChange={setPinLock}
          />
          <View style={s.divider} />
          <ToggleRow
            icon="finger-print-outline" label="Biometric Unlock" sub="Face ID or Fingerprint"
            value={biometric} onChange={setBiometric}
          />
          <View style={s.divider} />
          {/* Session Timeout Selector */}
          <View style={s.sessionRow}>
            <View style={s.toggleLeft}>
              <View style={s.rowIcon}>
                <Ionicons name="time-outline" size={16} color={COLORS.textSecondary} />
              </View>
              <Text style={s.rowLabel}>Session Timeout</Text>
            </View>
            <View style={s.sessionChips}>
              {SESSION_OPTS.map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[s.sessionChip, sessionTimeout === opt && s.sessionChipActive]}
                  onPress={() => setSession(opt)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.sessionChipTxt, sessionTimeout === opt && s.sessionChipTxtActive]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* ─── Account Security ──────────────────────────────── */}
        <SectionHeader icon="person-circle-outline" title="Account Security" color="#2563EB" bg="#EFF6FF" />
        <View style={s.card}>
          <ActionRow
            icon="key-outline" label="Change PIN"
            sub="Update your 6-digit unlock PIN"
            onPress={handleChangePin}
          />
          <View style={s.divider} />
          <ToggleRow
            icon="phone-portrait-outline" label="Two-Factor Authentication"
            sub="OTP verification on new device login"
            value={twoFactor} onChange={setTwoFactor}
          />
          <View style={s.divider} />
          <ToggleRow
            icon="notifications-outline" label="Login Alerts"
            sub="Notify me of new device logins"
            value={loginAlerts} onChange={setLoginAlerts}
          />
          <View style={s.divider} />
          <ActionRow
            icon="phone-portrait-outline" label="Active Devices"
            sub="Manage logged-in devices"
            badge="2 devices" badgeColor={COLORS.info}
            onPress={() => Alert.alert('Active Devices', 'iPhone 14 Pro (Current)\nMacBook Pro (2 days ago)')}
          />
        </View>

        {/* ─── Data Security ─────────────────────────────────── */}
        <SectionHeader icon="server-outline" title="Data Security" color="#0891B2" bg="#ECFEFF" />
        <View style={s.card}>
          <ToggleRow
            icon="shield-outline" label="End-to-End Encryption"
            sub="All data encrypted in transit & at rest"
            value={dataEncrypt} onChange={setEncrypt}
          />
          <View style={s.divider} />
          <ToggleRow
            icon="bug-outline" label="Crash Reports"
            sub="Auto-send crash logs to improve stability"
            value={crashReports} onChange={setCrash}
          />
          <View style={s.divider} />
          <ToggleRow
            icon="bar-chart-outline" label="Usage Statistics"
            sub="Anonymous usage data for app improvement"
            value={usageStats} onChange={setUsage}
          />
        </View>

        {/* ─── Data Management ───────────────────────────────── */}
        <SectionHeader icon="folder-outline" title="Data Management" color="#D97706" bg="#FFFBEB" />
        <View style={s.card}>
          <ActionRow
            icon="download-outline" label="Export My Data"
            sub="Download all transactions as CSV/PDF"
            onPress={handleExport}
          />
          <View style={s.divider} />
          <ActionRow
            icon="document-outline" label="Privacy Policy"
            sub="Read our full data privacy statement"
            onPress={() => Alert.alert('Privacy Policy', 'Available at tallydekho.com/privacy')}
          />
          <View style={s.divider} />
          <ActionRow
            icon="document-text-outline" label="Terms of Service"
            sub="Read our terms and conditions"
            onPress={() => Alert.alert('Terms of Service', 'Available at tallydekho.com/terms')}
          />
        </View>

        {/* ─── Danger Zone ────────────────────────────────────── */}
        <View style={s.dangerCard}>
          <View style={s.dangerHeader}>
            <Ionicons name="warning-outline" size={16} color="#E53935" />
            <Text style={s.dangerTitle}>Danger Zone</Text>
          </View>
          <ActionRow
            icon="trash-outline" label="Delete Account"
            sub="Permanently delete all data and account"
            onPress={handleDeleteAccount}
            danger
          />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm, paddingVertical: 10,
    backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn:     { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary },
  scroll: { flex: 1 },

  statusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    margin: SPACING.md, padding: 16,
    backgroundColor: '#F0FBF4', borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: '#BBF7D0',
  },
  statusIconBox: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center' },
  statusText: { flex: 1 },
  statusTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: '#1A4D2E' },
  statusSub:   { fontSize: TYPOGRAPHY.xs, color: '#2D7D46', marginTop: 2 },
  statusBadge: { backgroundColor: '#2D7D46', paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  statusBadgeTxt: { fontSize: 11, fontWeight: '700', color: COLORS.white },

  secHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: SPACING.md, marginTop: SPACING.md, marginBottom: 8,
  },
  secIcon:  { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  secTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, textTransform: 'uppercase', letterSpacing: 0.5 },

  card: {
    marginHorizontal: SPACING.md, backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: COLORS.borderDefault, marginLeft: 16 },

  toggleRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 14 },
  actionRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 14 },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  rowIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.borderDefault },
  toggleText: { flex: 1 },
  rowLabel: { fontSize: TYPOGRAPHY.base, fontWeight: '500', color: COLORS.textPrimary },
  rowSub:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  actionRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  badgeTxt: { fontSize: 11, fontWeight: '700' },

  sessionRow: { paddingHorizontal: SPACING.md, paddingVertical: 14, gap: 12 },
  sessionChips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', paddingLeft: 44 },
  sessionChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, borderWidth: 1.5, borderColor: COLORS.borderDefault },
  sessionChipActive:    { borderColor: COLORS.brandPrimary, backgroundColor: COLORS.brandPrimary },
  sessionChipTxt:       { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '500' },
  sessionChipTxtActive: { color: COLORS.white, fontWeight: '700' },

  dangerCard: {
    marginHorizontal: SPACING.md, marginTop: SPACING.md,
    backgroundColor: '#FEF2F2', borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: '#FCA5A5', overflow: 'hidden',
  },
  dangerHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: SPACING.md, paddingTop: 14, paddingBottom: 6,
  },
  dangerTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: '#E53935', textTransform: 'uppercase', letterSpacing: 0.5 },
});
