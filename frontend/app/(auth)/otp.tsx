import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, SafeAreaView, ActivityIndicator
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { verifyOTP, sendOTP } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';

const OTP_LENGTH = 6;

export default function OTPScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { signIn } = useAuth();
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(30);
  const inputRefs = useRef<(TextInput | null)[]>([]);

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
    }
  };

  const handleKeyPress = (key: string, idx: number) => {
    if (key === 'Backspace' && !otp[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
      const newOtp = [...otp];
      newOtp[idx - 1] = '';
      setOtp(newOtp);
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
      const res = await verifyOTP(phone || '', code) as any;
      if (res?.token) {
        if (res?.isNewUser) {
          // Don't call signIn() yet - user must complete registration first
          // Pass token as param so register/tally-sync can signIn after full onboarding
          router.replace({ pathname: '/(auth)/register', params: { phone, token: res.token } });
        } else {
          await signIn(res.token);
          router.replace('/(tabs)');
        }
      } else {
        setError('Invalid OTP. Please try again.');
      }
    } catch {
      setError('Verification failed. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setCountdown(30);
    setOtp(Array(OTP_LENGTH).fill(''));
    await sendOTP(phone || '');
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
            <Text style={styles.heading}>We've sent code to{'\n'}your WhatsApp number</Text>
            <Text style={styles.subHeading}>Code has been sent to {phone}</Text>

            {/* OTP Boxes */}
            <View style={styles.otpRow}>
              {otp.map((digit, idx) => (
                <TextInput
                  key={idx}
                  testID={`otp-input-${idx}`}
                  ref={ref => { inputRefs.current[idx] = ref; }}
                  style={[styles.otpBox, digit && styles.otpBoxFilled, error && styles.otpBoxError]}
                  value={digit}
                  onChangeText={text => handleChange(text, idx)}
                  onKeyPress={({ nativeEvent: { key } }) => handleKeyPress(key, idx)}
                  keyboardType="number-pad"
                  maxLength={1}
                  textAlign="center"
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
    gap: 10,
    marginBottom: SPACING.sm,
    justifyContent: 'space-between',
  },
  otpBox: {
    width: 44,
    height: 52,
    borderWidth: 1.5,
    borderColor: COLORS.borderDefault,
    borderRadius: RADIUS.md,
    fontSize: TYPOGRAPHY.xl,
    fontWeight: '700',
    color: COLORS.textPrimary,
    backgroundColor: COLORS.pageBg,
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
