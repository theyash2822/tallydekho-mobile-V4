import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { verifyPin, sendOTP } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';
import { navigateAfterAuth } from '../../src/utils/onboardingNav';
import { useTranslation } from 'react-i18next';
import { getPreAuthToken, clearPreAuthToken } from '../../src/utils/preAuthToken';
import { getBiometricPin } from '../../src/utils/biometricPin';

const PIN_LENGTH = 4;

// ── PIN Box (reuses same pattern as OTP boxes) ────────────────────────────────
function PinBox({
  char, filled, hasError, isFocused, onSetRef, onChangeText, onKeyPress, onFocus,
}: {
  char: string; filled: boolean; hasError: boolean; isFocused: boolean;
  onSetRef: (r: TextInput | null) => void;
  onChangeText: (t: string) => void;
  onKeyPress: (e: any) => void;
  onFocus: () => void;
}) {
  const localRef = useRef<TextInput>(null);
  return (
    <TouchableOpacity
      style={[s.box, filled && s.boxFilled, hasError && s.boxError, isFocused && s.boxFocused]}
      onPress={() => localRef.current?.focus()}
      activeOpacity={0.9}
    >
      {/* Show dot instead of character for security */}
      {filled ? <View style={s.dot} /> : (isFocused ? <View style={s.cursor} /> : null)}
      <TextInput
        ref={r => { (localRef as any).current = r; onSetRef(r); }}
        style={s.hiddenInput}
        value={char}
        onChangeText={onChangeText}
        onKeyPress={onKeyPress}
        onFocus={onFocus}
        keyboardType="number-pad"
        maxLength={1}
        caretHidden
        secureTextEntry
      />
    </TouchableOpacity>
  );
}

export default function VerifyPinScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { phone, biometric } = useLocalSearchParams<{ phone: string; biometric: string }>();
  const { signIn, setCompany } = useAuth();

  const [pin, setPin]                 = useState<string[]>(Array(PIN_LENGTH).fill(''));
  const [focusedIdx, setFocused]       = useState(0);
  const [loading, setLoading]          = useState(false);
  const [error, setError]              = useState('');
  const [mode, setMode]                = useState<'verify' | 'reset_otp' | 'reset_pin'>('verify');
  const [resetOtp, setResetOtp]        = useState('');
  const [preAuthToken, setPreAuthTokenState] = useState('');
  const preAuthTokenRef = useRef('');
  const [biometricAvail, setBioAvail]   = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const biometricEnabled = biometric === '1';

  // Check biometric hardware + load pre_auth_token
  useEffect(() => {
    getPreAuthToken().then(t => {
      if (t) {
        preAuthTokenRef.current = t;
        setPreAuthTokenState(t);
      }
    });

    // Check if device supports biometrics
    LocalAuthentication.hasHardwareAsync().then(hasHW => {
      if (!hasHW) return;
      LocalAuthentication.isEnrolledAsync().then(enrolled => {
        setBioAvail(enrolled);
        // If biometric enabled + available, auto-prompt after short delay
        if (enrolled && biometricEnabled) {
          setTimeout(() => triggerBiometric(), 600);
        } else {
          setTimeout(() => inputRefs.current[0]?.focus(), 400);
        }
      });
    });
  }, []);

  const triggerBiometric = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Verify your identity',
        fallbackLabel: 'Use PIN instead',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (result.success) {
        // Retrieve stored PIN from secure storage
        const storedPin = await getBiometricPin(phone);
        const token = preAuthTokenRef.current;
        if (storedPin && token) {
          await doVerify(storedPin);
        } else if (!storedPin) {
          // No stored PIN — biometric enabled but no PIN stored yet
          setError(t('auth.biometricFallback'));
          setTimeout(() => inputRefs.current[0]?.focus(), 100);
        }
      } else if (result.error !== 'user_cancel' && result.error !== 'system_cancel') {
        setError('Biometric failed. Enter PIN manually.');
        setTimeout(() => inputRefs.current[0]?.focus(), 100);
      }
    } catch {
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  };

  const handleChange = (text: string, idx: number) => {
    const digit = text.replace(/\D/g, '').slice(-1);
    const next = [...pin]; next[idx] = digit; setPin(next); setError('');
    if (digit && idx < PIN_LENGTH - 1) { inputRefs.current[idx + 1]?.focus(); setFocused(idx + 1); }
    // Auto-submit when last digit entered
    if (digit && idx === PIN_LENGTH - 1) {
      const full = [...next].join('');
      if (full.length === PIN_LENGTH) setTimeout(() => doVerify(full), 100);
    }
  };

  const handleKeyPress = (key: string, idx: number) => {
    if (key === 'Backspace') {
      const next = [...pin];
      if (pin[idx]) { next[idx] = ''; setPin(next); }
      else if (idx > 0) { next[idx - 1] = ''; setPin(next); inputRefs.current[idx - 1]?.focus(); setFocused(idx - 1); }
    }
  };

  const doVerify = async (code?: string) => {
    const enteredPin = code || pin.join('');
    if (enteredPin.length < PIN_LENGTH) { setError('Enter your full PIN'); return; }
    const token = preAuthTokenRef.current || preAuthToken;
    if (!token) { setError('Session expired. Please log in again.'); return; }
    setLoading(true); setError('');
    try {
      const res = await verifyPin(enteredPin, token);
      if (res?.success) {
        await clearPreAuthToken();
        const { access_token, refresh_token, user, company } = res.data;
        await signIn(
          access_token,
          user ? { id: user.id, name: user.name ?? undefined, phone: user.phone } : undefined,
          refresh_token,
        );
        if (company) await setCompany({ guid: company.guid, name: company.name, gstin: company.gstin ?? undefined });
        await navigateAfterAuth(router);
      } else {
        setPin(Array(PIN_LENGTH).fill(''));
        setFocused(0);
        setError(res?.error?.message || 'Incorrect PIN');
        setTimeout(() => inputRefs.current[0]?.focus(), 100);
      }
    } catch (err: any) {
      setPin(Array(PIN_LENGTH).fill(''));
      setFocused(0);
      setError(err?.message || 'Incorrect PIN. Try again.');
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPin = async () => {
    Alert.alert(
      'Reset PIN',
      `We'll send a new OTP to your WhatsApp number (${phone}) to verify it's you.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send OTP',
          onPress: async () => {
            try {
              await sendOTP(phone || '');
              router.replace({ pathname: '/(auth)/reset-pin' as any, params: { phone } });
            } catch {
              Alert.alert(t('common.error'), t('auth.otpSendFailed'));
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.flex}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>

        <View style={s.container}>
          {/* Icon */}
          <View style={s.iconBox}>
            <Ionicons name="lock-closed" size={28} color={COLORS.white} />
          </View>
          <Text style={s.appName}>TallyDekho</Text>

          <View style={s.card}>
            <Text style={s.heading}>Enter your Passkey</Text>
            <Text style={s.sub}>Your 4-digit security PIN</Text>

            {/* PIN Boxes */}
            <View style={s.pinRow}>
              {pin.map((char, idx) => (
                <PinBox
                  key={idx}
                  char={char}
                  filled={!!char}
                  hasError={!!error}
                  isFocused={focusedIdx === idx}
                  onSetRef={r => { inputRefs.current[idx] = r; }}
                  onChangeText={t => handleChange(t, idx)}
                  onKeyPress={({ nativeEvent: { key } }) => handleKeyPress(key, idx)}
                  onFocus={() => setFocused(idx)}
                />
              ))}
            </View>

            {error ? <Text style={s.errorText}>{error}</Text> : null}

            {/* Verify Button */}
            <TouchableOpacity
              style={[s.btn, pin.join('').length < PIN_LENGTH && s.btnDisabled]}
              onPress={() => doVerify()}
              disabled={pin.join('').length < PIN_LENGTH || loading}
              activeOpacity={0.8}
            >
              {loading
                ? <ActivityIndicator color={COLORS.white} size="small" />
                : <Text style={s.btnText}>Verify</Text>
              }
            </TouchableOpacity>

            {/* Biometric button */}
            {biometricAvail && biometricEnabled && (
              <TouchableOpacity style={s.bioBtn} onPress={triggerBiometric} activeOpacity={0.7}>
                <Ionicons
                  name={Platform.OS === 'ios' ? 'scan-circle-outline' : 'finger-print'}
                  size={22}
                  color={COLORS.brandPrimary}
                />
                <Text style={s.bioTxt}>
                  {Platform.OS === 'ios' ? 'Use Face ID / Touch ID' : 'Use Fingerprint'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Forgot PIN */}
            <TouchableOpacity style={s.forgotRow} onPress={handleForgotPin} activeOpacity={0.7}>
              <Text style={s.forgotText}>Forgot PIN?</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: COLORS.pageBg },
  flex:       { flex: 1 },
  backBtn:    { position: 'absolute', top: 56, left: 20, zIndex: 10, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  container:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.md },
  iconBox:    { width: 64, height: 64, borderRadius: 18, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  appName:    { fontSize: TYPOGRAPHY.lg, fontWeight: '800', color: COLORS.textPrimary, marginBottom: SPACING.xl },
  card:       { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.xl, padding: SPACING.lg, width: '100%', borderWidth: 1, borderColor: COLORS.borderDefault },
  heading:    { fontSize: TYPOGRAPHY.xl, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 6 },
  sub:        { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, marginBottom: SPACING.lg },
  pinRow:     { flexDirection: 'row', gap: 14, marginBottom: SPACING.sm, justifyContent: 'center' },
  box:        { width: 64, height: 64, borderWidth: 1.5, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  boxFocused: { borderColor: COLORS.brandPrimary, borderWidth: 2 },
  boxFilled:  { borderColor: COLORS.brandPrimary, backgroundColor: COLORS.cardBg },
  boxError:   { borderColor: COLORS.negative },
  dot:        { width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.textPrimary },
  cursor:     { width: 2, height: 28, backgroundColor: COLORS.brandPrimary, borderRadius: 1 },
  hiddenInput:{ position: 'absolute', width: '100%', height: '100%', opacity: 0 },
  errorText:  { fontSize: TYPOGRAPHY.sm, color: COLORS.negative, marginBottom: SPACING.sm },
  btn:        { height: 52, backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', marginTop: SPACING.sm },
  btnDisabled:{ backgroundColor: COLORS.borderStrong },
  btnText:    { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
  forgotRow:  { alignItems: 'center', marginTop: SPACING.md },
  forgotText: { fontSize: TYPOGRAPHY.sm, color: COLORS.brandPrimary, fontWeight: '600' },
  bioBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: SPACING.md, paddingVertical: 12, backgroundColor: COLORS.activeBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  bioTxt:     { fontSize: TYPOGRAPHY.sm, color: COLORS.brandPrimary, fontWeight: '600' },
});
