import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Modal,
  ScrollView, ActivityIndicator
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { safePush } from '../../src/utils/safeNavigation';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { registerUser, setRefreshToken, sendSignupEmailCode, verifySignupEmailCode } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';
import { AuditerMark, AuditerWordmark } from '../../src/components/AuditerLogo';
import { canProceedRegister, isValidWorkspaceName, WORKSPACE_NAME_MAX } from '../../src/utils/registerForm';

const LANGUAGES = ['English', 'Hindi', 'Bengali', 'Arabic', 'French', 'German', 'Italian', 'Japanese', 'Korean'];
const CODE_LENGTH = 6;

export default function RegisterScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { phone, token } = useLocalSearchParams<{ phone: string; token: string }>();
  const { signIn } = useAuth();
  const [name, setName] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceNameTouched, setWorkspaceNameTouched] = useState(false);
  const [email, setEmail] = useState('');
  const [language, setLanguage] = useState('English');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [langModal, setLangModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Email verification: a 6-digit code to the email; "Skip for now" registers without it.
  const [stage, setStage] = useState<'form' | 'verify'>('form');
  const [code, setCode] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [sendFailed, setSendFailed] = useState(false);

  const canProceed = canProceedRegister({ name, email, workspaceName, termsAccepted });
  const workspaceNameError = workspaceNameTouched && !isValidWorkspaceName(workspaceName);

  // Store the token from OTP verify so register can call authenticated endpoint
  useEffect(() => {
    if (token) {
      AsyncStorage.setItem('auth_token', token);
    }
  }, [token]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn(s => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  const sendCode = async () => {
    setLoading(true);
    setError('');
    try {
      await sendSignupEmailCode(email.trim());
      setCode('');
      setSendFailed(false);
      setStage('verify');
      setResendIn(30);
    } catch (err: any) {
      setSendFailed(true);
      setError(err?.message || t('screens.authRegister.somethingWentWrong'));
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    if (!isValidWorkspaceName(workspaceName)) { setWorkspaceNameTouched(true); return; }
    if (!canProceed) return;
    await sendCode();
  };

  const handleVerify = async () => {
    if (code.length < CODE_LENGTH) { setError(t('auth.enterCompleteOtp')); return; }
    setLoading(true);
    setError('');
    try {
      await verifySignupEmailCode(email.trim(), code);
    } catch (err: any) {
      setError(err?.message || t('screens.authRegister.somethingWentWrong'));
      setLoading(false);
      return;
    }
    await handleLogin();
  };

  const handleLogin = async () => {
    if (!canProceed) return;
    setLoading(true);
    setError('');
    try {
      const res = await registerUser({
        name: name.trim(),
        workspace_name: workspaceName.trim(),
        email: email.trim(),
        language,
      });
      if (res?.success && res?.data?.access_token) {
        // IMPORTANT: Store token directly — do NOT call signIn() here.
        // signIn() sets isAuthenticated=true which makes _layout.tsx redirect to /(tabs)
        // before the user reaches tally-sync. Two conflicting navigations = iOS crash.
        // signIn() is called from tally-sync.tsx after pairing (or on skip).
        await AsyncStorage.setItem('auth_token', res.data.access_token);
        // signIn() would normally do this; registration bypasses it, and without
        // the refresh token a brand-new account's first session dies in 15 min.
        await setRefreshToken(res.data.refresh_token);
        // Store user info under the correct key (user_info, not user_data)
        await AsyncStorage.setItem('user_info', JSON.stringify({
          id: res.data.user.id,
          name: res.data.user.name ?? undefined,
          phone: res.data.user.phone,
          email: res.data.user.email,
          language: res.data.user.language,
        }));
        router.replace('/(auth)/tally-sync');
      } else {
        setError(t('screens.authRegister.registrationFailed'));
      }
    } catch (err: any) {
      // The fields the server refused can only be corrected on the form.
      if (err?.code === 'VALIDATION_ERROR') setStage('form');
      setError(err?.message || t('screens.authRegister.somethingWentWrong'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView testID="register-screen" style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={styles.logoBox}>
            <AuditerMark height={26} color={COLORS.white} />
          </View>
          <View style={styles.appName}><AuditerWordmark height={24} color={COLORS.textPrimary} /></View>

          {/* Card */}
          <View style={styles.card}>
            {stage === 'form' ? (
            <>
            <Text style={styles.heading}>{t('onboarding.getStarted')}</Text>
            <Text style={styles.subHeading}>{t('screens.authRegister.subHeading')}</Text>

            {/* Full Name */}
            <Text style={styles.label}>{t('profile.fullName')}</Text>
            <TextInput
              testID="full-name-input"
              style={styles.input}
              placeholder={t('screens.authRegister.fullNamePlaceholder')}
              placeholderTextColor={COLORS.textTertiary}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              returnKeyType="next"
            />

            {/* Workspace name */}
            <Text style={styles.label}>{t('screens.authRegister.workspaceName')}</Text>
            <TextInput
              testID="workspace-name-input"
              style={[styles.input, styles.inputWithHint]}
              placeholder={t('screens.authRegister.workspaceNamePlaceholder')}
              placeholderTextColor={COLORS.textTertiary}
              value={workspaceName}
              onChangeText={setWorkspaceName}
              onBlur={() => setWorkspaceNameTouched(true)}
              autoCapitalize="words"
              maxLength={WORKSPACE_NAME_MAX}
              returnKeyType="next"
            />
            <Text testID="workspace-name-hint" style={[styles.fieldHint, workspaceNameError && styles.fieldHintError]}>
              {workspaceNameError ? t('screens.authRegister.workspaceNameInvalid') : t('screens.authRegister.workspaceNameHint')}
            </Text>

            {/* Email */}
            <Text style={styles.label}>{t('screens.authRegister.emailAddress')}</Text>
            <TextInput
              testID="email-input"
              style={styles.input}
              placeholder="yourname@example.com"
              placeholderTextColor={COLORS.textTertiary}
              value={email}
              onChangeText={v => { setEmail(v.toLowerCase()); setSendFailed(false); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />

            {/* Language Selector */}
            <Text style={styles.label}>{t('screens.authRegister.chooseLanguage')}</Text>
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
                {t('screens.authRegister.accept')}{' '}
                <Text style={styles.link} onPress={() => safePush(router, '/(auth)/terms' as any)}>
                  {t('screens.authRegister.termsLink')}
                </Text>
              </Text>
            </TouchableOpacity>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {/* Continue: sends a code to the email */}
            <TouchableOpacity
              testID="register-login-btn"
              style={[styles.primaryBtn, !canProceed && styles.primaryBtnDisabled]}
              onPress={handleContinue}
              disabled={!canProceed || loading}
              activeOpacity={0.8}
            >
              {loading ? <ActivityIndicator color={COLORS.white} size="small" /> : (
                <Text style={styles.primaryBtnText}>{t('common.continue')}</Text>
              )}
            </TouchableOpacity>
            {sendFailed ? (
              <TouchableOpacity
                testID="register-skip-btn"
                style={styles.secondaryBtn}
                onPress={handleLogin}
                disabled={!canProceed || loading}
                activeOpacity={0.7}
              >
                <Text style={styles.secondaryBtnText}>{t('auth.skipForNow')}</Text>
              </TouchableOpacity>
            ) : null}
            </>
            ) : (
            <>
            <Text style={styles.heading}>{t('auth.verifyEmailHeading')}</Text>
            <Text style={styles.subHeading}>{t('auth.verifyEmailSub', { email: email.trim() })}</Text>

            <TextInput
              testID="email-code-input"
              style={[styles.input, styles.codeInput]}
              value={code}
              onChangeText={v => { setCode(v.replace(/\D/g, '').slice(0, CODE_LENGTH)); setError(''); }}
              keyboardType="number-pad"
              maxLength={CODE_LENGTH}
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              placeholder="••••••"
              placeholderTextColor={COLORS.textTertiary}
              autoFocus
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              testID="verify-email-btn"
              style={[styles.primaryBtn, code.length < CODE_LENGTH && styles.primaryBtnDisabled]}
              onPress={handleVerify}
              disabled={code.length < CODE_LENGTH || loading}
              activeOpacity={0.8}
            >
              {loading ? <ActivityIndicator color={COLORS.white} size="small" /> : (
                <Text style={styles.primaryBtnText}>{t('screens.settingsProfile.verifyContinue')}</Text>
              )}
            </TouchableOpacity>

            <View style={styles.codeLinks}>
              <TouchableOpacity testID="resend-email-code-btn" onPress={sendCode} disabled={resendIn > 0 || loading}>
                <Text style={[styles.link, (resendIn > 0 || loading) && styles.linkDisabled]}>
                  {resendIn > 0 ? t('auth.resendOtpTimer', { countdown: resendIn }) : t('auth.resendOtp')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity testID="change-email-btn" onPress={() => { setStage('form'); setError(''); }} disabled={loading}>
                <Text style={styles.link}>{t('auth.changeEmail')}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              testID="register-skip-btn"
              style={styles.secondaryBtn}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryBtnText}>{t('auth.skipForNow')}</Text>
            </TouchableOpacity>
            </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Language Modal */}
      <Modal visible={langModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{t('screens.authRegister.chooseLanguage')}</Text>
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
  container: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.md },
  logoBox: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: COLORS.brandPrimary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  appName: { marginBottom: SPACING.xl },
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
  inputWithHint: { marginBottom: 6 },
  fieldHint: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, lineHeight: 16, marginBottom: SPACING.md },
  fieldHintError: { color: COLORS.negative },
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
  codeInput: { textAlign: 'center', fontSize: TYPOGRAPHY.xl, letterSpacing: 8, fontWeight: '700' },
  codeLinks: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.md },
  linkDisabled: { color: COLORS.textTertiary },
  secondaryBtn: { height: 44, alignItems: 'center', justifyContent: 'center', marginTop: SPACING.sm },
  secondaryBtnText: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
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
