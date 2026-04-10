import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { sendOTP } from '../../src/services/api';

export default function LoginScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isValid = phone.replace(/\D/g, '').length === 10;

  const handleSendOTP = async () => {
    if (!isValid) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await sendOTP(phone);
      router.push({ pathname: '/(auth)/otp', params: { phone: `+91${phone}` } });
    } catch {
      setError('Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView testID="login-screen" style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View style={styles.container}>
          {/* Logo */}
          <View style={styles.logoSection}>
            <View style={styles.logoBox}>
              <Ionicons name="stats-chart" size={32} color={COLORS.white} />
            </View>
            <Text style={styles.appName}>Tallydekho</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.heading}>Enter your{'\n'}Whatsapp Number</Text>

            {/* Phone Input */}
            <View style={[styles.inputRow, error ? styles.inputError : null]}>
              <View style={styles.prefix}>
                <Text style={styles.prefixText}>+91</Text>
                <View style={styles.prefixDivider} />
              </View>
              <TextInput
                testID="phone-input"
                style={styles.input}
                placeholder="XXXXXXXXXX"
                placeholderTextColor={COLORS.textTertiary}
                keyboardType="phone-pad"
                maxLength={10}
                value={phone}
                onChangeText={t => { setPhone(t.replace(/\D/g, '')); setError(''); }}
              />
            </View>

            {error ? (
              <Text testID="login-error" style={styles.errorText}>{error}</Text>
            ) : null}

            {/* Send OTP Button */}
            <TouchableOpacity
              testID="send-otp-btn"
              style={[styles.primaryBtn, !isValid && styles.primaryBtnDisabled]}
              onPress={handleSendOTP}
              disabled={!isValid || loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <Text style={styles.primaryBtnText}>Send OTP</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.disclaimer}>
              By continuing, you agree to our{' '}
              <Text style={styles.link} onPress={() => router.push('/(auth)/terms' as any)}>
                Terms & Privacy Policy
              </Text>
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  flex: { flex: 1 },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
    gap: 12,
  },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: COLORS.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    fontSize: TYPOGRAPHY.xl,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
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
    fontSize: TYPOGRAPHY.xxl,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.lg,
    lineHeight: 36,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.borderDefault,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.pageBg,
    height: 52,
    overflow: 'hidden',
  },
  inputError: {
    borderColor: COLORS.negative,
  },
  prefix: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 10,
    height: '100%',
    gap: 6,
  },
  prefixText: {
    fontSize: TYPOGRAPHY.base,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  prefixDivider: {
    width: 1,
    height: 20,
    backgroundColor: COLORS.borderDefault,
  },
  input: {
    flex: 1,
    fontSize: TYPOGRAPHY.md,
    color: COLORS.textPrimary,
    paddingRight: 14,
    letterSpacing: 2,
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
  primaryBtnDisabled: {
    backgroundColor: COLORS.borderStrong,
  },
  primaryBtnText: {
    fontSize: TYPOGRAPHY.base,
    fontWeight: '700',
    color: COLORS.white,
    letterSpacing: 0.3,
  },
  disclaimer: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.textTertiary,
    textAlign: 'center',
    marginTop: SPACING.md,
    lineHeight: 18,
  },
  link: {
    color: COLORS.brandPrimary,
    fontWeight: '600',
  },
});
