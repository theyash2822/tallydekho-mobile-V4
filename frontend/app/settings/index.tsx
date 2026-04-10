import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { MOCK_USER } from '../../src/data/mockData';

function SettingRow({ icon, label, value, onPress, danger, toggle, toggleValue, onToggle }: any) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={toggle ? 1 : 0.7}>
      <View style={[styles.rowIcon, danger ? styles.dangerIcon : styles.normalIcon]}>
        <Ionicons name={icon} size={18} color={danger ? COLORS.negative : COLORS.textSecondary} />
      </View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, danger && styles.dangerText]}>{label}</Text>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      </View>
      {toggle ? (
        <Switch
          value={toggleValue}
          onValueChange={onToggle}
          trackColor={{ false: COLORS.borderDefault, true: COLORS.positive }}
          thumbColor={COLORS.white}
        />
      ) : (
        <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} />
      )}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const [pushNotif, setPushNotif] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(false);
  const [smsAlerts, setSmsAlerts] = useState(true);
  const user = MOCK_USER;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user.name.charAt(0)}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user.name}</Text>
            <Text style={styles.profilePhone}>{user.phone}</Text>
            <Text style={styles.profileCompany} numberOfLines={1}>{user.company}</Text>
          </View>
          <TouchableOpacity style={styles.editBtn}>
            <Ionicons name="pencil-outline" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Account & Business */}
        <Text style={styles.sectionLabel}>Account & Business</Text>
        <View style={styles.section}>
          <SettingRow icon="person-outline" label="Profile Settings" value="Name, Phone, Email" onPress={() => {}} />
          <View style={styles.sep} />
          <SettingRow icon="business-outline" label="Business Information" value={user.company} onPress={() => {}} />
          <View style={styles.sep} />
          <SettingRow icon="link-outline" label="Tally Sync" value="Connected" onPress={() => {}} />
          <View style={styles.sep} />
          <SettingRow icon="shield-checkmark-outline" label="GSTIN" value={user.gstin} onPress={() => {}} />
        </View>

        {/* Preferences */}
        <Text style={styles.sectionLabel}>Preferences</Text>
        <View style={styles.section}>
          <SettingRow icon="language-outline" label="Language" value="English" onPress={() => {}} />
          <View style={styles.sep} />
          <SettingRow icon="moon-outline" label="Theme" value="Light" onPress={() => {}} />
          <View style={styles.sep} />
          <SettingRow icon="calendar-outline" label="Date Format" value="DD/MM/YYYY" onPress={() => {}} />
          <View style={styles.sep} />
          <SettingRow icon="cash-outline" label="Currency" value="INR (₹)" onPress={() => {}} />
        </View>

        {/* Notifications */}
        <Text style={styles.sectionLabel}>Notifications</Text>
        <View style={styles.section}>
          <SettingRow icon="notifications-outline" label="Push Notifications" toggle toggleValue={pushNotif} onToggle={setPushNotif} />
          <View style={styles.sep} />
          <SettingRow icon="mail-outline" label="Email Alerts" toggle toggleValue={emailAlerts} onToggle={setEmailAlerts} />
          <View style={styles.sep} />
          <SettingRow icon="chatbubble-outline" label="SMS Alerts" toggle toggleValue={smsAlerts} onToggle={setSmsAlerts} />
        </View>

        {/* Data */}
        <Text style={styles.sectionLabel}>Data & Privacy</Text>
        <View style={styles.section}>
          <SettingRow icon="cloud-upload-outline" label="Backup Data" value="Last backup: Today" onPress={() => {}} />
          <View style={styles.sep} />
          <SettingRow icon="trash-outline" label="Clear Cache" onPress={() => {}} />
          <View style={styles.sep} />
          <SettingRow icon="lock-closed-outline" label="Privacy Policy" onPress={() => {}} />
        </View>

        {/* About */}
        <Text style={styles.sectionLabel}>About</Text>
        <View style={styles.section}>
          <SettingRow icon="information-circle-outline" label="App Version" value="1.0.0 (Build 1)" onPress={() => {}} />
          <View style={styles.sep} />
          <SettingRow icon="document-text-outline" label="Terms of Service" onPress={() => {}} />
          <View style={styles.sep} />
          <SettingRow icon="help-circle-outline" label="Help & Support" onPress={() => {}} />
        </View>

        {/* Sign Out */}
        <View style={styles.section}>
          <SettingRow icon="log-out-outline" label="Sign Out" danger onPress={() => router.push('/' as any)} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg, margin: SPACING.md, borderRadius: RADIUS.lg, padding: SPACING.md, gap: 14, borderWidth: 1, borderColor: COLORS.borderDefault },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.white },
  profileInfo: { flex: 1, gap: 2 },
  profileName: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  profilePhone: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  profileCompany: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  editBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginHorizontal: SPACING.md, marginTop: SPACING.md, marginBottom: 6 },
  section: { backgroundColor: COLORS.cardBg, marginHorizontal: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  sep: { height: 1, backgroundColor: COLORS.borderDefault, marginLeft: 52 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 14, gap: 12 },
  rowIcon: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  normalIcon: { backgroundColor: COLORS.pageBg },
  dangerIcon: { backgroundColor: COLORS.negativeBg },
  rowContent: { flex: 1, gap: 2 },
  rowLabel: { fontSize: TYPOGRAPHY.base, fontWeight: '500', color: COLORS.textPrimary },
  rowValue: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  dangerText: { color: COLORS.negative, fontWeight: '600' },
});
