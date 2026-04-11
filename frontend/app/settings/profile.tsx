import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { MOCK_USER } from '../../src/data/mockData';

export default function ProfileScreen() {
  const router = useRouter();
  const [name, setName] = useState(MOCK_USER.name);
  const [email, setEmail] = useState('ashish@ykind.com');
  const [phone] = useState(MOCK_USER.phone);
  const [role, setRole] = useState('Admin');

  const handleSave = () => {
    Alert.alert('Profile Updated', 'Your profile has been saved successfully.');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.7}>
          <Text style={styles.saveBtnText}>Save</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Avatar */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{name[0]?.toUpperCase()}</Text>
            </View>
            <TouchableOpacity style={styles.changePhotoBtn} activeOpacity={0.7}>
              <Ionicons name="camera-outline" size={14} color={COLORS.brandPrimary} />
              <Text style={styles.changePhotoText}>Change Photo</Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Personal Information</Text>

            {[
              { label: 'Full Name', value: name, setter: setName, placeholder: 'Enter your name', editable: true },
              { label: 'Email',     value: email, setter: setEmail, placeholder: 'Enter email', editable: true },
              { label: 'Phone',     value: phone, setter: () => {}, placeholder: '', editable: false },
              { label: 'Role',      value: role, setter: setRole, placeholder: 'Enter role', editable: true },
            ].map((field, idx, arr) => (
              <View key={field.label} style={[styles.fieldWrap, idx < arr.length - 1 && styles.fieldBorder]}>
                <Text style={styles.fieldLabel}>{field.label}</Text>
                <TextInput
                  style={[styles.fieldInput, !field.editable && styles.fieldDisabled]}
                  value={field.value}
                  onChangeText={field.setter as any}
                  placeholder={field.placeholder}
                  placeholderTextColor={COLORS.textTertiary}
                  editable={field.editable}
                />
              </View>
            ))}
          </View>

          {/* Linked accounts */}
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Linked Accounts</Text>
            {[
              { label: 'Google',  icon: 'logo-google',   linked: true,  account: 'ashish@gmail.com' },
              { label: 'Tally',   icon: 'sync-outline',  linked: true,  account: 'Paired - Tally Prime' },
              { label: 'WhatsApp',icon: 'logo-whatsapp', linked: true,  account: MOCK_USER.phone },
            ].map((acc, idx, arr) => (
              <TouchableOpacity
                key={acc.label}
                style={[styles.accountRow, idx < arr.length - 1 && styles.fieldBorder]}
                activeOpacity={0.7}
              >
                <View style={styles.accLeft}>
                  <Ionicons name={acc.icon as any} size={20} color={COLORS.textSecondary} />
                  <View>
                    <Text style={styles.accLabel}>{acc.label}</Text>
                    <Text style={styles.accDetail}>{acc.account}</Text>
                  </View>
                </View>
                <View style={[styles.linkedBadge, { backgroundColor: acc.linked ? '#F0FBF4' : '#F3F4F6' }]}>
                  <Text style={[styles.linkedText, { color: acc.linked ? '#2D7D46' : '#6B7280' }]}>
                    {acc.linked ? 'Linked' : 'Connect'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: 80 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.pageBg },
  header:  {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn:     { width: 40, alignItems: 'flex-start' },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  saveBtn:     { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md },
  saveBtnText: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.white },
  scroll: { flex: 1 },

  avatarSection:  { alignItems: 'center', paddingVertical: 24, gap: 12 },
  avatarCircle:   { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F59E0B', alignItems: 'center', justifyContent: 'center' },
  avatarText:     { fontSize: 32, fontWeight: '800', color: COLORS.white },
  changePhotoBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  changePhotoText:{ fontSize: TYPOGRAPHY.sm, color: COLORS.brandPrimary, fontWeight: '600' },

  formCard:   { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, marginHorizontal: SPACING.md, marginBottom: SPACING.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  formTitle:  { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.sm },
  fieldWrap:  { paddingVertical: 12 },
  fieldBorder:{ borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  fieldLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginBottom: 4 },
  fieldInput: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, padding: 0 },
  fieldDisabled: { color: COLORS.textTertiary },

  accountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  accLeft:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  accLabel:   { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  accDetail:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },
  linkedBadge:{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  linkedText: { fontSize: TYPOGRAPHY.xs, fontWeight: '700' },
});
