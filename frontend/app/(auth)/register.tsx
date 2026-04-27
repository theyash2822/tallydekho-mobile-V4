import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Modal,
  ScrollView, ActivityIndicator
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { registerUser } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';

const LANGUAGES = ['English', 'Hindi', 'Bengali', 'Arabic', 'French', 'German', 'Italian', 'Japanese', 'Korean'];

export default function RegisterScreen() {
  const router = useRouter();
  const { phone, token } = useLocalSearchParams<{ phone: string; token: string }>();
  const { signIn } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [language, setLanguage] = useState('English');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [langModal, setLangModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
  const canProceed = name.trim().length > 1 && isValidEmail(email) && termsAccepted;

  // Store the token from OTP verify so register can call authenticated endpoint
  useEffect(() => {
    if (token) {
      AsyncStorage.setItem('auth_token', token);
    }
  }, [token]);

  const handleLogin = async () => {
    if (!canProceed) return;
    setLoading(true);
    setError('');
    try {
      const res = await registerUser({ name: name.trim(), email: email.trim(), language });
      if (res?.success && res?.data?.access_token) {
        // Store token but do NOT call signIn() here — that would set isAuthenticated=true
        // and _layout.tsx would redirect to (tabs) before we reach tally-sync
        await AsyncStorage.setItem('auth_token', res.data.access_token);
        await AsyncStorage.setItem('user_data', JSON.stringify({ name: res.data.user.name, mobile: res.data.user.phone }));
        router.replace('/(auth)/tally-sync');
      } else {
        setError('Registration failed. Please retry.');
      }
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView testID="register-screen" style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <View style={styles.container}>
          {/* Logo */}
          <View style={styles.logoBox}>
            <Ionicons name="stats-chart" size={28} color={COLORS.white} />
          </View>
          <Text style={styles.appName}>Tallydekho</Text>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.heading}>Get Started</Text>
            <Text style={styles.subHeading}>Log in to access your profile and get started easily.</Text>

            {/* Full Name */}
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              testID="full-name-input"
              style={styles.input}
              placeholder="Enter your full name"
              placeholderTextColor={COLORS.textTertiary}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              returnKeyType="next"
            />

            {/* Email */}
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              testID="email-input"
              style={styles.input}
              placeholder="yourname@example.com"
              placeholderTextColor={COLORS.textTertiary}
              value={email}
              onChangeText={t => setEmail(t.toLowerCase())}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />

            {/* Language Selector */}
            <Text style={styles.label}>Choose Language</Text>
            <TouchableOpacity
              testID="language-selector"
              style={styles.selector}
              onPress={() => setLangModal(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.selectorText}>{language}</Text>
              <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
            </TouchableOpacity>

            {/* Terms */}
            <TouchableOpacity
              testID="terms-checkbox"
              style={styles.termsRow}
              onPress={() => setTermsAccepted(p => !p)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
                {termsAccepted && <Ionicons name="checkmark" size={12} color={COLORS.white} />}
              </View>
              <Text style={styles.termsText}>
                Accept{' '}
                <Text style={styles.link} onPress={() => router.push('/(auth)/terms' as any)}>
                  Terms and Conditions &amp; Privacy Policy
                </Text>
              </Text>
            </TouchableOpacity>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {/* Login Button */}
            <TouchableOpacity
              testID="register-login-btn"
              style={[styles.primaryBtn, !canProceed && styles.primaryBtnDisabled]}
              onPress={handleLogin}
              disabled={!canProceed || loading}
              activeOpacity={0.8}
            >
              {loading ? <ActivityIndicator color={COLORS.white} size="small" /> : (
                <Text style={styles.primaryBtnText}>Login</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Language Modal */}
      <Modal visible={langModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Choose Language</Text>
            <ScrollView>
              {LANGUAGES.map(lang => (
                <TouchableOpacity
                  key={lang}
                  testID={`lang-option-${lang}`}
                  style={[styles.langItem, language === lang && styles.langItemActive]}
                  onPress={() => { setLanguage(lang); setLangModal(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.langText, language === lang && styles.langTextActive]}>
                    {lang}
                  </Text>
                  {language === lang && <Ionicons name="checkmark" size={18} color={COLORS.brandPrimary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  flex: { flex: 1 },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.md },
  logoBox: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: COLORS.brandPrimary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  appName: { fontSize: TYPOGRAPHY.lg, fontWeight: '800', color: COLORS.textPrimary, marginBottom: SPACING.xl },
  card: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.xl,
    padding: SPACING.lg, width: '100%',
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  heading: { fontSize: TYPOGRAPHY.xxl, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  subHeading: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, marginBottom: SPACING.lg, lineHeight: 20 },
  label: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  input: {
    height: 48, borderWidth: 1.5, borderColor: COLORS.borderDefault,
    borderRadius: RADIUS.md, paddingHorizontal: 14,
    fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary,
    backgroundColor: COLORS.pageBg, marginBottom: SPACING.md,
  },
  selector: {
    height: 48, borderWidth: 1.5, borderColor: COLORS.borderDefault,
    borderRadius: RADIUS.md, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.pageBg, marginBottom: SPACING.md,
  },
  selectorText: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: SPACING.md },
  checkbox: {
    width: 20, height: 20, borderRadius: 4,
    borderWidth: 1.5, borderColor: COLORS.borderStrong,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  checkboxChecked: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  termsText: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, lineHeight: 20 },
  link: { color: COLORS.brandPrimary, fontWeight: '600' },
  errorText: { fontSize: TYPOGRAPHY.sm, color: COLORS.negative, marginBottom: SPACING.sm },
  primaryBtn: { height: 52, backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', marginTop: SPACING.sm },
  primaryBtnDisabled: { backgroundColor: COLORS.borderStrong },
  primaryBtnText: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: COLORS.overlay },
  modalSheet: {
    backgroundColor: COLORS.cardBg, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: SPACING.md, maxHeight: '60%',
  },
  modalTitle: { fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.md },
  langItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  langItemActive: { backgroundColor: COLORS.activeBg, borderRadius: RADIUS.sm, paddingHorizontal: 8 },
  langText: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  langTextActive: { fontWeight: '600' },
});
