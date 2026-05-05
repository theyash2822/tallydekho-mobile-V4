import React, { useState, useRef, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { verifyOTP, sendOTP } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const OTP_LENGTH = 4;

// ─────────────────────────────────────────────────────────────────────────────
// OTP Box: View+Text display with an invisible TextInput for keyboard events.
// This is the most reliable cross-platform way to get perfectly centred digits.
// ─────────────────────────────────────────────────────────────────────────────
function OTPBox({
  digit, filled, hasError, isFocused,
  onSetRef, onChangeText, onKeyPress, onFocus,
}: {
  digit: string;
  filled: boolean;
  hasError: boolean;
  isFocused: boolean;
  onSetRef: (ref: TextInput | null) => void;
  onChangeText: (t: string) => void;
  onKeyPress: (e: any) => void;
  onFocus: () => void;
}) {
  const localRef = useRef<TextInput>(null);

  const handlePress = () => localRef.current?.focus();

  return (
    <TouchableOpacity
      style={[
        styles.otpBox,
        filled   && styles.otpBoxFilled,
        hasError && styles.otpBoxError,
        isFocused && styles.otpBoxFocused,
      ]}
      onPress={handlePress}
      activeOpacity={0.9}
    >
      {/* Perfectly centred digit via flexbox — no iOS alignment issues */}
      <Text style={styles.otpDigit}>{digit}</Text>

      {/* Blinking cursor bar when focused + empty */}
      {isFocused && !digit ? <View style={styles.cursor} /> : null}

      {/* Invisible TextInput that captures keyboard events */}
      <TextInput
        ref={ref => { (localRef as any).current = ref; onSetRef(ref); }}
        style={styles.hiddenInput}
        value={digit}
        onChangeText={onChangeText}
        onKeyPress={onKeyPress}
        onFocus={onFocus}
        keyboardType="number-pad"
        maxLength={1}
        caretHidden
        selectTextOnFocus={false}
      />
    </TouchableOpacity>
  );
}

export default function OTPScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { signIn, setCompany, setIsPaired } = useAuth();
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [focusedIdx, setFocusedIdx] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(30);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Auto-focus first box on mount
  useEffect(() => {
    setTimeout(() => inputRefs.current[0]?.focus(), 400);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCountdown(c => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleChange = (text: string, idx: number) => {
    const digit = text.replace(/\D/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[idx] = digit;
    setOtp(newOtp);
    setError('');
    if (digit && idx < OTP_LENGTH - 1) {
      inputRefs.current[idx + 1]?.focus();
      setFocusedIdx(idx + 1);
    }
  };

  const handleKeyPress = (key: string, idx: number) => {
    if (key === 'Backspace') {
      const newOtp = [...otp];
      if (otp[idx]) {
        newOtp[idx] = '';
        setOtp(newOtp);
      } else if (idx > 0) {
        newOtp[idx - 1] = '';
        setOtp(newOtp);
        inputRefs.current[idx - 1]?.focus();
        setFocusedIdx(idx - 1);
      }
    }
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length < OTP_LENGTH) {
      setError('Please enter the complete OTP');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await verifyOTP(phone || '', code);
      if (res?.success) {
        const data = res.data;

        // ── 2FA required — route to PIN screen
        if (data?.requires_2fa) {
          await AsyncStorage.setItem('pre_auth_token', data.pre_auth_token || '');
          router.replace({
            pathname: '/(auth)/verify-pin' as any,
            params: { phone, biometric: data.biometric_enabled ? '1' : '0' },
          });
          return;
        }

        // ── No 2FA — normal login
        const { access_token, is_new_user, user, is_paired, company } = data;
        if (is_new_user) {
          router.replace({ pathname: '/(auth)/register', params: { phone, token: access_token } });
        } else {
          await signIn(access_token || '', user ? { id: user.id, name: user.name ?? undefined, phone: user.phone } : undefined);
          setIsPaired(is_paired === true);
          if (company) await setCompany({ guid: company.guid, name: company.name, gstin: company.gstin ?? undefined });
          router.replace('/(tabs)');
        }
      } else {
        setError('Invalid OTP. Please try again.');
      }
    } catch (err: any) {
      setError(err?.message || 'Verification failed. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setCountdown(30);
    setOtp(Array(OTP_LENGTH).fill(''));
    setFocusedIdx(0);
    await sendOTP(phone || '');
    setTimeout(() => inputRefs.current[0]?.focus(), 300);
  };

  return (
    <SafeAreaView testID="otp-screen" style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>

        <View style={styles.container}>
          {/* Logo */}
          <View style={styles.logoBox}>
            <Ionicons name="stats-chart" size={28} color={COLORS.white} />
          </View>
          <Text style={styles.appName}>Tallydekho</Text>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.heading}>We've sent a 4-digit{'\n'}code to your WhatsApp</Text>
            <Text style={styles.subHeading}>Code has been sent to {phone}</Text>

            {/* OTP Boxes */}
            <View style={styles.otpRow}>
              {otp.map((digit, idx) => (
                <OTPBox
                  key={idx}
                  digit={digit}
                  filled={!!digit}
                  hasError={!!error}
                  isFocused={focusedIdx === idx}
                  onSetRef={ref => { inputRefs.current[idx] = ref; }}
                  onChangeText={text => handleChange(text, idx)}
                  onKeyPress={({ nativeEvent: { key } }) => handleKeyPress(key, idx)}
                  onFocus={() => setFocusedIdx(idx)}
                />
              ))}
            </View>

            {error ? <Text testID="otp-error" style={styles.errorText}>{error}</Text> : null}

            {/* Continue Button */}
            <TouchableOpacity
              testID="verify-otp-btn"
              style={[styles.primaryBtn, otp.join('').length < OTP_LENGTH && styles.primaryBtnDisabled]}
              onPress={handleVerify}
              disabled={otp.join('').length < OTP_LENGTH || loading}
              activeOpacity={0.8}
            >
              {loading ? <ActivityIndicator color={COLORS.white} size="small" /> : (
                <Text style={styles.primaryBtnText}>Continue</Text>
              )}
            </TouchableOpacity>

            {/* Resend */}
            <TouchableOpacity
              testID="resend-otp-btn"
              onPress={handleResend}
              disabled={countdown > 0}
              style={styles.resendRow}
              activeOpacity={0.7}
            >
              <Text style={[styles.resendText, countdown > 0 && styles.resendDisabled]}>
                {countdown > 0 ? `Resend OTP (${countdown}s)` : 'Resend OTP'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  flex: { flex: 1 },
  backBtn: {
    position: 'absolute',
    top: 56,
    left: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
  },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: COLORS.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  appName: {
    fontSize: TYPOGRAPHY.lg,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xl,
  },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
  },
  heading: {
    fontSize: TYPOGRAPHY.xl,
    fontWeight: '700',
    color: COLORS.textPrimary,
    lineHeight: 32,
    marginBottom: 8,
  },
  subHeading: {
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },
  otpRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: SPACING.sm,
    justifyContent: 'center',
  },
  // ── New OTP Box: View+Text approach for perfect iOS/Android centering ──────
  otpBox: {
    width: 64,
    height: 64,
    borderWidth: 1.5,
    borderColor: COLORS.borderDefault,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.pageBg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  otpBoxFocused: { borderColor: COLORS.brandPrimary, borderWidth: 2 },
  otpDigit: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.textPrimary,
    includeFontPadding: false,
  },
  // Blinking cursor bar shown when box is focused but empty
  cursor: {
    width: 2,
    height: 28,
    backgroundColor: COLORS.brandPrimary,
    borderRadius: 1,
  },
  // The actual keyboard-capturing input — completely invisible
  hiddenInput: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0,
    color: 'transparent',
  },
  otpBoxFilled: {
    borderColor: COLORS.brandPrimary,
    backgroundColor: COLORS.cardBg,
  },
  otpBoxError: {
    borderColor: COLORS.negative,
  },
  errorText: {
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.negative,
    marginBottom: SPACING.sm,
  },
  primaryBtn: {
    height: 52,
    backgroundColor: COLORS.brandPrimary,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
  },
  primaryBtnDisabled: { backgroundColor: COLORS.borderStrong },
  primaryBtnText: {
    fontSize: TYPOGRAPHY.base,
    fontWeight: '700',
    color: COLORS.white,
  },
  resendRow: {
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  resendText: {
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.brandPrimary,
    fontWeight: '600',
  },
  resendDisabled: { color: COLORS.textTertiary },
});
