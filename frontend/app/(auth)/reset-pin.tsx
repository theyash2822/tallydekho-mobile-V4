import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { verifyOTP, resetPin, sendOTP } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';

const BOX_LENGTH = 4;

function CodeBox({
  char, filled, hasError, isFocused, secure,
  onSetRef, onChangeText, onKeyPress, onFocus,
}: {
  char: string; filled: boolean; hasError: boolean; isFocused: boolean; secure?: boolean;
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
      {secure && filled
        ? <View style={s.dot} />
        : <Text style={s.digit}>{char}</Text>
      }
      {isFocused && !char ? <View style={s.cursor} /> : null}
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
        secureTextEntry={secure}
      />
    </TouchableOpacity>
  );
}

type Step = 'otp' | 'new_pin' | 'confirm_pin';

export default function ResetPinScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { signIn, setCompany, setIsPaired } = useAuth();

  const [step, setStep]         = useState<Step>('otp');
  const [otp, setOtp]           = useState<string[]>(Array(BOX_LENGTH).fill(''));
  const [newPin, setNewPin]      = useState<string[]>(Array(BOX_LENGTH).fill(''));
  const [confirmPin, setConfirm] = useState<string[]>(Array(BOX_LENGTH).fill(''));
  const [focusedIdx, setFocused] = useState(0);
  const [loading, setLoading]    = useState(false);
  const [error, setError]        = useState('');
  const [preAuthToken, setPreToken] = useState('');
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => { setTimeout(() => inputRefs.current[0]?.focus(), 400); }, [step]);

  const current = step === 'otp' ? otp : step === 'new_pin' ? newPin : confirmPin;
  const setCurrent = step === 'otp' ? setOtp : step === 'new_pin' ? setNewPin : setConfirm;
  const isSecure = step !== 'otp';

  const handleChange = (text: string, idx: number) => {
    const digit = text.replace(/\D/g, '').slice(-1);
    const next = [...current]; next[idx] = digit; setCurrent(next); setError('');
    if (digit && idx < BOX_LENGTH - 1) { inputRefs.current[idx + 1]?.focus(); setFocused(idx + 1); }
    if (digit && idx === BOX_LENGTH - 1) {
      const full = [...next].join('');
      if (full.length === BOX_LENGTH) setTimeout(() => handleNext(full), 100);
    }
  };

  const handleKeyPress = (key: string, idx: number) => {
    if (key === 'Backspace') {
      const next = [...current];
      if (current[idx]) { next[idx] = ''; setCurrent(next); }
      else if (idx > 0) { next[idx - 1] = ''; setCurrent(next); inputRefs.current[idx - 1]?.focus(); setFocused(idx - 1); }
    }
  };

  const handleNext = async (code?: string) => {
    const val = code || current.join('');
    if (val.length < BOX_LENGTH) { setError(`Enter all ${BOX_LENGTH} digits`); return; }

    if (step === 'otp') {
      setLoading(true); setError('');
      try {
        // Verify OTP with reset_pin=true — backend skips 2FA check and issues pre_auth_token
        const r = await verifyOTP(phone || '', val, { reset_pin: true });
        if (!r?.success) throw new Error('Invalid OTP');
        // For reset flow, backend always returns pre_auth_token
        const token = r?.data?.pre_auth_token || r?.data?.access_token || '';
        if (!token) throw new Error('Could not verify OTP');
        setPreToken(token);
        await AsyncStorage.setItem('pre_auth_token', token);
        setStep('new_pin');
      } catch (err: any) {
        setError(err?.message || 'Invalid OTP. Try again.');
        setOtp(Array(BOX_LENGTH).fill(''));
        setFocused(0);
      } finally { setLoading(false); }

    } else if (step === 'new_pin') {
      setStep('confirm_pin');

    } else if (step === 'confirm_pin') {
      if (newPin.join('') !== val) {
        setError("PINs don't match. Try again.");
        setConfirm(Array(BOX_LENGTH).fill(''));
        setFocused(0);
        return;
      }
      setLoading(true); setError('');
      try {
        const token = preAuthToken || (await AsyncStorage.getItem('pre_auth_token')) || '';
        const res = await resetPin(newPin.join(''), token);
        if (res?.success) {
          await AsyncStorage.removeItem('pre_auth_token');
          const { access_token, is_new_user, user, is_paired, company } = res.data;
          await signIn(access_token, user ? { id: user.id, name: user.name ?? undefined, phone: user.phone } : undefined);
          setIsPaired(is_paired === true);
          if (company) await setCompany({ guid: company.guid, name: company.name, gstin: company.gstin ?? undefined });
          router.replace('/(tabs)');
        } else {
          throw new Error(res?.error?.message || 'Reset failed');
        }
      } catch (err: any) {
        setError(err?.message || 'Could not reset PIN');
      } finally { setLoading(false); }
    }
  };

  const titles: Record<Step, { heading: string; sub: string; btn: string }> = {
    otp:         { heading: 'Verify Your Identity',   sub: `Enter the OTP sent to ${phone}`, btn: 'Verify OTP' },
    new_pin:     { heading: 'Set New PIN',             sub: 'Enter a new 4-digit passkey',    btn: 'Continue' },
    confirm_pin: { heading: 'Confirm New PIN',         sub: 'Re-enter your new passkey',      btn: 'Reset PIN' },
  };
  const { heading, sub, btn } = titles[step];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.flex}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={s.container}>
          <View style={s.iconBox}>
            <Ionicons name="key-outline" size={28} color={COLORS.white} />
          </View>
          <Text style={s.appName}>Reset Passkey</Text>
          <View style={s.card}>
            <Text style={s.heading}>{heading}</Text>
            <Text style={s.subText}>{sub}</Text>

            <View style={s.pinRow}>
              {current.map((char, idx) => (
                <CodeBox
                  key={`${step}-${idx}`}
                  char={char}
                  filled={!!char}
                  hasError={!!error}
                  isFocused={focusedIdx === idx}
                  secure={isSecure}
                  onSetRef={r => { inputRefs.current[idx] = r; }}
                  onChangeText={t => handleChange(t, idx)}
                  onKeyPress={({ nativeEvent: { key } }) => handleKeyPress(key, idx)}
                  onFocus={() => setFocused(idx)}
                />
              ))}
            </View>

            {error ? <Text style={s.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[s.btn, current.join('').length < BOX_LENGTH && s.btnDisabled]}
              onPress={() => handleNext()}
              disabled={current.join('').length < BOX_LENGTH || loading}
              activeOpacity={0.8}
            >
              {loading
                ? <ActivityIndicator color={COLORS.white} size="small" />
                : <Text style={s.btnText}>{btn}</Text>
              }
            </TouchableOpacity>

            {/* Step indicator */}
            <View style={s.steps}>
              {(['otp', 'new_pin', 'confirm_pin'] as Step[]).map((st, i) => (
                <View key={st} style={[s.stepDot, step === st && s.stepDotActive,
                  (['otp', 'new_pin', 'confirm_pin'] as Step[]).indexOf(step) > i && s.stepDotDone]} />
              ))}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: COLORS.pageBg },
  flex:         { flex: 1 },
  backBtn:      { position: 'absolute', top: 56, left: 20, zIndex: 10, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  container:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.md },
  iconBox:      { width: 64, height: 64, borderRadius: 18, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  appName:      { fontSize: TYPOGRAPHY.lg, fontWeight: '800', color: COLORS.textPrimary, marginBottom: SPACING.xl },
  card:         { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.xl, padding: SPACING.lg, width: '100%', borderWidth: 1, borderColor: COLORS.borderDefault },
  heading:      { fontSize: TYPOGRAPHY.xl, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 6 },
  subText:      { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, marginBottom: SPACING.lg },
  pinRow:       { flexDirection: 'row', gap: 14, marginBottom: SPACING.sm, justifyContent: 'center' },
  box:          { width: 64, height: 64, borderWidth: 1.5, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  boxFocused:   { borderColor: COLORS.brandPrimary, borderWidth: 2 },
  boxFilled:    { borderColor: COLORS.brandPrimary, backgroundColor: COLORS.cardBg },
  boxError:     { borderColor: COLORS.negative },
  dot:          { width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.textPrimary },
  digit:        { fontSize: 28, fontWeight: '700', color: COLORS.textPrimary, includeFontPadding: false },
  cursor:       { width: 2, height: 28, backgroundColor: COLORS.brandPrimary, borderRadius: 1 },
  hiddenInput:  { position: 'absolute', width: '100%', height: '100%', opacity: 0 },
  errorText:    { fontSize: TYPOGRAPHY.sm, color: COLORS.negative, marginBottom: SPACING.sm },
  btn:          { height: 52, backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', marginTop: SPACING.sm },
  btnDisabled:  { backgroundColor: COLORS.borderStrong },
  btnText:      { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
  steps:        { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: SPACING.md },
  stepDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.borderStrong },
  stepDotActive:{ backgroundColor: COLORS.brandPrimary },
  stepDotDone:  { backgroundColor: COLORS.positive },
});
