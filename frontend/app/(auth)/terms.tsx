import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

const TERMS_CONTENT = `Welcome to Tallydekho! By using our app, you agree to the following terms and conditions. Please read them carefully.

Acceptance of Terms
By accessing or using Tallydekho, you agree to be bound by these Terms and Conditions and our Privacy Policy. If you do not agree, please do not use our app.

Use of the App
• You must be at least 18 years old to use Tallydekho.
• You agree to use the app for lawful purposes only.
• You are responsible for maintaining the confidentiality of your account credentials.

User Accounts
• You must provide accurate and complete information during registration.
• You are solely responsible for all activities under your account.
• Notify us immediately of any unauthorized use of your account.

Intellectual Property
All content, trademarks, and intellectual property within Tallydekho are owned by us or our licensors.

Privacy Policy
At Tallydekho, your privacy is important to us. We collect personal information such as name, email, and phone number during registration. We use this data to provide and improve our services.

Limitation of Liability
Tallydekho shall not be liable for any indirect or consequential damages arising from use of the app.

Effective Date: 23 January 2025`;

export default function TermsScreen() {
  const router = useRouter();
  return (
    <SafeAreaView testID="terms-screen" style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms and conditions</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.body}>{TERMS_CONTENT}</Text>
        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          testID="accept-terms-btn"
          style={styles.acceptBtn}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Text style={styles.acceptBtnText}>I Accept</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDefault,
    backgroundColor: COLORS.cardBg,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  content: { flex: 1, padding: SPACING.md },
  body: {
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.textSecondary,
    lineHeight: 22,
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
  },
  footer: {
    padding: SPACING.md,
    backgroundColor: COLORS.cardBg,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderDefault,
  },
  acceptBtn: {
    height: 52,
    backgroundColor: COLORS.brandPrimary,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtnText: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});
