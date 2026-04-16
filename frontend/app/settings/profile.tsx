import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, KeyboardAvoidingView, Platform, Alert,
  Modal, Animated, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { MOCK_USER } from '../../src/data/mockData';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const local  = digits.length >= 10 ? digits.slice(-10) : digits;
  const first2 = local.slice(0, 2);
  const last2  = local.slice(-2);
  return `+91 ${first2}** **** ${last2}`;
}

function maskEmail(email: string): string {
  const idx = email.indexOf('@');
  if (idx < 0) return email;
  const local  = email.slice(0, idx);
  const domain = email.slice(idx);
  const visible = local.slice(0, 2);
  const stars  = '*'.repeat(Math.max(local.length - 2, 4));
  return `${visible}${stars}${domain}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// CustomNumPad
// ─────────────────────────────────────────────────────────────────────────────
function CustomNumPad({ onPress }: { onPress: (key: string) => void }) {
  const ROWS = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['',  '0', 'back'],
  ];
  return (
    <View style={ps.numPad}>
      {ROWS.map((row, ri) => (
        <View key={ri} style={[ps.numRow, ri === ROWS.length - 1 && { borderBottomWidth: 0 }]}>
          {row.map((key, ci) => {
            if (!key) {
              return <View key={ci} style={[ps.numKeyEmpty, ci < row.length - 1 && ps.numKeyBorderR]} />;
            }
            return (
              <TouchableOpacity
                key={ci}
                style={[ps.numKey, ci < row.length - 1 && ps.numKeyBorderR]}
                onPress={() => onPress(key)}
                activeOpacity={0.45}
              >
                {key === 'back' ? (
                  <Ionicons name="backspace-outline" size={22} color={COLORS.textPrimary} />
                ) : (
                  <Text style={ps.numKeyText}>{key}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CustomToggle — theme-aware animated switch (works on web + native)
// ─────────────────────────────────────────────────────────────────────────────
function CustomToggle({
  value,
  onValueChange,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: value ? 1 : 0,
      useNativeDriver: false,
      tension: 80,
      friction: 9,
    }).start();
  }, [value]);

  const trackBg = anim.interpolate({
    inputRange:  [0, 1],
    outputRange: [COLORS.borderDefault, COLORS.brandPrimary],
  });

  const thumbPos = anim.interpolate({
    inputRange:  [0, 1],
    outputRange: [3, 23],
  });

  return (
    <TouchableOpacity
      onPress={() => onValueChange(!value)}
      activeOpacity={0.85}
      style={{ padding: 4 }}
    >
      <Animated.View style={[ps.toggleTrack, { backgroundColor: trackBg }]}>
        <Animated.View style={[ps.toggleThumb, { left: thumbPos }]} />
      </Animated.View>
    </TouchableOpacity>
  );
}
// ─────────────────────────────────────────────────────────────────────────────
function PinBoxes({ value, length = 4 }: { value: string; length?: number }) {
  return (
    <View style={ps.pinRow}>
      {Array.from({ length }).map((_, i) => (
        <View
          key={i}
          style={[ps.pinBox, i < value.length && ps.pinBoxFilled]}
        >
          {i < value.length && <View style={ps.pinDot} />}
        </View>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DeleteAccountModal
// ─────────────────────────────────────────────────────────────────────────────
function DeleteAccountModal({
  visible,
  onClose,
  phone,
}: {
  visible: boolean;
  onClose: () => void;
  phone: string;
}) {
  const [otp, setOtp]         = useState('');
  const [countdown, setCount] = useState(30);
  const [canResend, setResend] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = () => {
    setCount(30); setResend(false);
    timerRef.current = setInterval(() => {
      setCount(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    if (visible) { setOtp(''); startTimer(); }
    else clearInterval(timerRef.current!);
    return () => clearInterval(timerRef.current!);
  }, [visible]);

  const handleKey = (key: string) => {
    if (key === 'back') setOtp(p => p.slice(0, -1));
    else if (otp.length < 4) setOtp(p => p + key);
  };

  const handleDelete = () => {
    if (otp.length < 4) return;
    onClose();
    setTimeout(() =>
      Alert.alert('Account Deleted', 'Your account has been permanently deleted.'),
    300);
  };

  const handleResend = () => {
    if (!canResend) return;
    startTimer();
    Alert.alert('OTP Resent', `A new verification code has been sent to ${phone} via WhatsApp.`);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={ps.modalOverlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={ps.modalSheet}>
          <View style={ps.handle} />

          {/* Heading */}
          <Text style={ps.modalTitle}>Delete Account Confirmation</Text>
          <Text style={ps.modalSub}>
            {'Code has been sent to '}
            <Text style={{ color: COLORS.textPrimary, fontWeight: '700' }}>{phone}</Text>
            {' via WhatsApp.  '}
            <Text
              style={ps.changeLink}
              onPress={() =>
                Alert.alert('Change Number', 'Contact support to change your registered number.')
              }
            >
              Change?
            </Text>
          </Text>

          {/* OTP boxes */}
          <PinBoxes value={otp} />

          {/* Delete button */}
          <TouchableOpacity
            style={[ps.modalBtn, ps.deleteBtnColor, otp.length < 4 && ps.btnDisabled]}
            onPress={handleDelete}
            activeOpacity={0.85}
            disabled={otp.length < 4}
          >
            <Text style={ps.modalBtnText}>Delete Account</Text>
          </TouchableOpacity>

          {/* Resend */}
          <TouchableOpacity
            style={ps.resendRow}
            onPress={handleResend}
            activeOpacity={canResend ? 0.7 : 1}
          >
            <Text style={[ps.resendText, !canResend && { color: COLORS.textTertiary }]}>
              {canResend ? 'Resend OTP' : `Resend OTP (${countdown}s)`}
            </Text>
          </TouchableOpacity>

          {/* Number pad */}
          <CustomNumPad onPress={handleKey} />
          <View style={{ height: 12 }} />
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CreatePasskeyModal
// ─────────────────────────────────────────────────────────────────────────────
function CreatePasskeyModal({
  visible,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [pin, setPin] = useState('');

  useEffect(() => { if (!visible) setPin(''); }, [visible]);

  const handleKey = (key: string) => {
    if (key === 'back') setPin(p => p.slice(0, -1));
    else if (pin.length < 4) setPin(p => p + key);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={ps.modalOverlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={ps.modalSheet}>
          <View style={ps.handle} />

          {/* Heading */}
          <Text style={ps.modalTitle}>Create A Passkey</Text>
          <Text style={ps.modalSub}>Enter A 4-Character Passkey</Text>

          {/* PIN boxes */}
          <PinBoxes value={pin} />

          {/* Confirm button */}
          <TouchableOpacity
            style={[ps.modalBtn, ps.confirmBtnColor, pin.length < 4 && ps.btnDisabled]}
            onPress={() => pin.length === 4 && onConfirm()}
            activeOpacity={0.85}
            disabled={pin.length < 4}
          >
            <Text style={ps.modalBtnText}>Confirm</Text>
          </TouchableOpacity>

          {/* Reset link */}
          <TouchableOpacity style={ps.resendRow} onPress={() => setPin('')} activeOpacity={0.7}>
            <Text style={[ps.resendText, { color: COLORS.info }]}>Reset passcode</Text>
          </TouchableOpacity>

          {/* Number pad */}
          <CustomNumPad onPress={handleKey} />
          <View style={{ height: 12 }} />
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OTPVerifySheet — 4-step: verify current → enter new → verify new
// Step 1: Enter current value  (TextInput)
// Step 2: OTP for current      (CustomNumPad, 6-digit)
// Step 3: Enter new value      (TextInput)
// Step 4: OTP for new value    (CustomNumPad, 6-digit)
// ─────────────────────────────────────────────────────────────────────────────
type OTPChannel = 'whatsapp' | 'email';

function OTPVerifySheet({
  visible,
  onClose,
  onSuccess,
  channel,
  title,
  inputPlaceholder,
  inputKeyboard,
  sendLabel,
  getSubtitle,
}: {
  visible:          boolean;
  onClose:          () => void;
  onSuccess:        (newValue: string) => void;
  channel:          OTPChannel;
  title:            string;
  inputPlaceholder: string;
  inputKeyboard:    'phone-pad' | 'email-address';
  sendLabel:        string;
  getSubtitle:      (val: string) => string;
}) {
  const isPhone      = inputKeyboard === 'phone-pad';
  const channelLabel = channel === 'whatsapp' ? 'WhatsApp' : 'Email';

  const [step,       setStep]       = useState<1|2|3|4>(1);
  const [currentVal, setCurrentVal] = useState('');
  const [newVal,     setNewVal]     = useState('');
  const [otp,        setOtp]        = useState('');
  const [countdown,  setCountdown]  = useState(30);
  const [canResend,  setCanResend]  = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset on close
  useEffect(() => {
    if (!visible) {
      setTimeout(() => {
        setStep(1); setCurrentVal(''); setNewVal('');
        setOtp(''); setCountdown(30); setCanResend(false);
      }, 350);
    }
    return () => clearInterval(timerRef.current!);
  }, [visible]);

  const startTimer = () => {
    clearInterval(timerRef.current!);
    setCountdown(30); setCanResend(false);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); setCanResend(true); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendCurrentOTP   = () => { setOtp(''); setStep(2); startTimer(); };
  const handleVerifyCurrentOTP = () => { if (otp.length < 4) return; setOtp(''); setStep(3); };
  const handleSendNewOTP       = () => { setOtp(''); setStep(4); startTimer(); };
  const handleVerifyNewOTP     = () => {
    if (otp.length < 4) return;
    onSuccess(newVal.trim()); onClose();
  };

  const handleResend = () => {
    if (!canResend) return;
    startTimer();
    Alert.alert('OTP Resent', `A new code has been sent to you via ${channelLabel}.`, [{ text: 'OK' }]);
  };

  const handleKey = (key: string) => {
    if (key === 'back') setOtp(p => p.slice(0, -1));
    else if (otp.length < 4) setOtp(p => p + key);
  };

  const isCurrentValid = isPhone ? currentVal.length === 10 : currentVal.includes('@') && currentVal.length > 5;
  const isNewValid     = isPhone ? newVal.length === 10     : newVal.includes('@')     && newVal.length > 5;

  const channelIcon: React.ReactNode =
    channel === 'whatsapp'
      ? <FontAwesome5 name="whatsapp" size={15} color="#25D366" />
      : <Ionicons name="mail-outline" size={15} color={COLORS.white} />;

  const stepTitles: Record<1|2|3|4, string> = {
    1: `Verify Current ${isPhone ? 'Number' : 'Email'}`,
    2: 'Enter OTP',
    3: `New ${isPhone ? 'Phone Number' : 'Email Address'}`,
    4: 'Confirm New OTP',
  };

  const displayCurrent = isPhone ? `+91 ${currentVal}` : currentVal;
  const displayNew     = isPhone ? `+91 ${newVal}`     : newVal;

  /* ── Input step (1 & 3) ──────────────────────────────── */
  const renderInput = (isCurrentStep: boolean) => {
    const val     = isCurrentStep ? currentVal : newVal;
    const setter  = isCurrentStep ? setCurrentVal : setNewVal;
    const canSend = isCurrentStep ? isCurrentValid : isNewValid;
    const onSend  = isCurrentStep ? handleSendCurrentOTP : handleSendNewOTP;
    const subTitle = isCurrentStep
      ? `Enter your current ${isPhone ? 'phone number' : 'email address'}`
      : `Enter your new ${isPhone ? 'phone number' : 'email address'}`;

    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Text style={ps.modalSub}>{subTitle}</Text>

        {/* Input row */}
        <View style={ps.editInputWrap}>
          {isPhone && (
            <View style={ps.phonePre}>
              <Text style={ps.phonePreText}>+91</Text>
            </View>
          )}
          <TextInput
            style={ps.editInput}
            value={val}
            onChangeText={text =>
              isPhone ? setter(text.replace(/[^0-9]/g, '').slice(0, 10)) : setter(text)
            }
            placeholder={inputPlaceholder}
            placeholderTextColor={COLORS.textTertiary}
            keyboardType={inputKeyboard}
            autoCapitalize="none"
            autoFocus
            maxLength={isPhone ? 10 : 80}
            selectionColor={COLORS.brandPrimary}
          />
        </View>

        {/* Send OTP button */}
        <TouchableOpacity
          style={[ps.modalBtn, ps.confirmBtnColor, !canSend && ps.btnDisabled]}
          onPress={onSend}
          activeOpacity={0.85}
          disabled={!canSend}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {channelIcon}
            <Text style={ps.modalBtnText}>{sendLabel}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={ps.resendRow} onPress={onClose} activeOpacity={0.7}>
          <Text style={[ps.resendText, { color: COLORS.textTertiary }]}>Cancel</Text>
        </TouchableOpacity>
        <View style={{ height: 16 }} />
      </KeyboardAvoidingView>
    );
  };

  /* ── OTP step (2 & 4) ────────────────────────────────── */
  const renderOTP = (isCurrentStep: boolean) => {
    const display   = isCurrentStep ? displayCurrent : displayNew;
    const onVerify  = isCurrentStep ? handleVerifyCurrentOTP : handleVerifyNewOTP;
    const btnLabel  = isCurrentStep ? 'Verify & Continue →' : 'Verify & Update ✓';
    const canVerify = otp.length === 4;

    return (
      <View>
        <Text style={ps.modalSub}>
          {getSubtitle(display)}{'\n'}
          <Text style={{ fontWeight: '700', color: channel === 'whatsapp' ? '#25D366' : COLORS.brandPrimary }}>
            via {channelLabel}
          </Text>
        </Text>

        {/* 4-digit OTP boxes */}
        <PinBoxes value={otp} length={4} />

        {/* Verify button */}
        <TouchableOpacity
          style={[ps.modalBtn, ps.confirmBtnColor, !canVerify && ps.btnDisabled]}
          onPress={onVerify}
          activeOpacity={0.85}
          disabled={!canVerify}
        >
          <Text style={ps.modalBtnText}>{btnLabel}</Text>
        </TouchableOpacity>

        {/* Resend / Didn't receive */}
        <TouchableOpacity
          style={ps.resendRow}
          onPress={handleResend}
          activeOpacity={canResend ? 0.7 : 1}
        >
          {canResend ? (
            <Text style={[ps.resendText, { color: COLORS.brandPrimary, textDecorationLine: 'underline' }]}>
              Didn't receive OTP? Resend
            </Text>
          ) : (
            <Text style={[ps.resendText, { color: COLORS.textTertiary }]}>
              Resend OTP in {countdown}s
            </Text>
          )}
        </TouchableOpacity>

        {/* Custom numpad */}
        <CustomNumPad onPress={handleKey} />
        <View style={{ height: 12 }} />
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={ps.modalOverlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={ps.modalSheet}>
          <View style={ps.handle} />

          {/* ── Step progress ── */}
          <View style={ps.stepTrack}>
            {([1, 2, 3, 4] as (1|2|3|4)[]).map(s => (
              <View
                key={s}
                style={[
                  ps.stepDot,
                  s === step && ps.stepDotActive,
                  s <  step  && ps.stepDotDone,
                ]}
              />
            ))}
          </View>

          <Text style={ps.modalTitle}>{stepTitles[step]}</Text>

          {step === 1 && renderInput(true)}
          {step === 2 && renderOTP(true)}
          {step === 3 && renderInput(false)}
          {step === 4 && renderOTP(false)}
        </View>
      </View>
    </Modal>
  );
}


export default function ProfileScreen() {
  const router = useRouter();

  // Form state
  const [name,  setName]  = useState(MOCK_USER.name || 'Rajesh Sharma');
  const [role,  setRole]  = useState('Admin');
  const [phone, setPhone] = useState(MOCK_USER.phone || '9876543210');
  const [email, setEmail] = useState('ashish@ykind.com');

  // Security
  const [biometric, setBiometric] = useState(true);
  const [twoFA,     setTwoFA]     = useState(false);

  // Modals
  const [showDelete,    setShowDelete]    = useState(false);
  const [showPasskey,   setShowPasskey]   = useState(false);
  const [showEditPhone, setShowEditPhone] = useState(false);
  const [showEditEmail, setShowEditEmail] = useState(false);

  // Save toast animation (slidedown below header)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const toastH    = useRef(new Animated.Value(0)).current;
  const toastOpac = useRef(new Animated.Value(0)).current;

  const showToast = (state: 'saving' | 'saved') => {
    setSaveState(state);
    Animated.parallel([
      Animated.spring(toastH,    { toValue: 48, useNativeDriver: false, tension: 80, friction: 10 }),
      Animated.timing(toastOpac, { toValue: 1,  useNativeDriver: false, duration: 200 }),
    ]).start();
  };

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(toastH,    { toValue: 0, useNativeDriver: false, duration: 250 }),
      Animated.timing(toastOpac, { toValue: 0, useNativeDriver: false, duration: 200 }),
    ]).start(() => setSaveState('idle'));
  };

  const handleSave = () => {
    showToast('saving');
    setTimeout(() => {
      showToast('saved');
      setTimeout(hideToast, 1600);
    }, 1100);
  };

  const handle2FAToggle = (val: boolean) => {
    if (val) { setShowPasskey(true); }
    else     { setTwoFA(false); }
  };

  return (
    <SafeAreaView style={ps.safe} edges={['top', 'left', 'right']}>
      {/* ── Nav Header ─────────────────────────────────────────────────── */}
      <View style={ps.header}>
        <TouchableOpacity style={ps.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={ps.headerTitle}>Profile</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* ── Animated Toast banner (slides down below header) ──────────── */}
      <Animated.View
        style={[
          ps.toast,
          saveState === 'saved' && ps.toastSaved,
          { maxHeight: toastH, opacity: toastOpac, overflow: 'hidden' },
        ]}
      >
        <View style={ps.toastInner}>
          {saveState === 'saving' ? (
            <>
              <ActivityIndicator size="small" color={COLORS.white} />
              <Text style={ps.toastText}>Saving changes…</Text>
            </>
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={16} color={COLORS.white} />
              <Text style={ps.toastText}>Saved successfully</Text>
            </>
          )}
        </View>
      </Animated.View>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={ps.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={ps.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Personal Info ────────────────────────────────────────── */}
          <SectionLabel title="PERSONAL INFORMATION" />
          <View style={ps.card}>
            {/* Full Name */}
            <View style={ps.fieldWrap}>
              <Text style={ps.fieldLabel}>Full Name</Text>
              <TextInput
                style={ps.fieldInput}
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
                placeholderTextColor={COLORS.textTertiary}
                selectionColor={COLORS.brandPrimary}
                returnKeyType="next"
              />
            </View>

            <View style={ps.hr} />

            {/* Role */}
            <View style={ps.fieldWrap}>
              <Text style={ps.fieldLabel}>Role</Text>
              <TextInput
                style={ps.fieldInput}
                value={role}
                onChangeText={setRole}
                placeholder="Enter your role"
                placeholderTextColor={COLORS.textTertiary}
                selectionColor={COLORS.brandPrimary}
                returnKeyType="done"
              />
            </View>

            <View style={ps.hr} />

            {/* Phone (masked) */}
            <View style={ps.fieldWrap}>
              <Text style={ps.fieldLabel}>Phone Number</Text>
              <View style={ps.maskedRow}>
                <Text style={ps.maskedValue}>{maskPhone(phone)}</Text>
                <View style={ps.verifiedPill}>
                  <Ionicons name="checkmark-circle" size={12} color={COLORS.positive} />
                  <Text style={ps.verifiedText}>Verified</Text>
                </View>
                <TouchableOpacity
                  style={ps.editBtn}
                  onPress={() => setShowEditPhone(true)}
                  activeOpacity={0.7}
                >
                  <Text style={ps.editBtnText}>Edit</Text>
                  <Ionicons name="chevron-forward" size={11} color={COLORS.brandPrimary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={ps.hr} />

            {/* Email (masked) */}
            <View style={[ps.fieldWrap, { paddingBottom: 16 }]}>
              <Text style={ps.fieldLabel}>Email</Text>
              <View style={ps.maskedRow}>
                <Text style={ps.maskedValue}>{maskEmail(email)}</Text>
                <View style={ps.verifiedPill}>
                  <Ionicons name="checkmark-circle" size={12} color={COLORS.positive} />
                  <Text style={ps.verifiedText}>Verified</Text>
                </View>
                <TouchableOpacity
                  style={ps.editBtn}
                  onPress={() => setShowEditEmail(true)}
                  activeOpacity={0.7}
                >
                  <Text style={ps.editBtnText}>Edit</Text>
                  <Ionicons name="chevron-forward" size={11} color={COLORS.brandPrimary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* ── Security ─────────────────────────────────────────────── */}
          <SectionLabel title="SECURITY" />
          <View style={ps.card}>
            {/* Biometric */}
            <View style={ps.toggleRow}>
              <View style={ps.toggleLeft}>
                <View style={ps.iconBox}>
                  <Ionicons name="finger-print-outline" size={17} color={COLORS.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ps.toggleLabel}>Biometric &amp; screen lock</Text>
                  <Text style={ps.toggleSub}>Face ID / Fingerprint on app open</Text>
                </View>
              </View>
              <CustomToggle value={biometric} onValueChange={setBiometric} />
            </View>

            <View style={ps.hr} />

            {/* PassKey 2FA */}
            <View style={[ps.toggleRow, { borderBottomWidth: 0 }]}>
              <View style={ps.toggleLeft}>
                <View style={ps.iconBox}>
                  <Ionicons name="key-outline" size={17} color={COLORS.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ps.toggleLabel}>PassKey (2FA)</Text>
                  <Text style={ps.toggleSub}>
                    {twoFA ? '4-digit passkey active' : 'Extra security for sensitive actions'}
                  </Text>
                </View>
              </View>
              <CustomToggle value={twoFA} onValueChange={handle2FAToggle} />
            </View>
          </View>

          {/* ── Save Button ───────────────────────────────────────────── */}
          <TouchableOpacity style={ps.saveBtn} onPress={handleSave} activeOpacity={0.85}>
            <Text style={ps.saveBtnText}>Save Changes</Text>
          </TouchableOpacity>

          {/* ── Delete Account ────────────────────────────────────────── */}
          <TouchableOpacity
            style={ps.deleteTextBtn}
            onPress={() => setShowDelete(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={14} color={COLORS.negative} />
            <Text style={ps.deleteTextBtnLabel}>Delete Account</Text>
          </TouchableOpacity>

          <View style={{ height: 50 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Modals ─────────────────────────────────────────────────────── */}
      <DeleteAccountModal
        visible={showDelete}
        onClose={() => setShowDelete(false)}
        phone={maskPhone(phone)}
      />
      <CreatePasskeyModal
        visible={showPasskey}
        onClose={() => setShowPasskey(false)}
        onConfirm={() => { setTwoFA(true); setShowPasskey(false); }}
      />

      {/* ── Edit Phone — WhatsApp OTP ───────────────────────────────────── */}
      <OTPVerifySheet
        visible={showEditPhone}
        onClose={() => setShowEditPhone(false)}
        onSuccess={(newPhone) => {
          setPhone(newPhone);
          Alert.alert('Phone Updated', 'Your phone number has been updated successfully.');
        }}
        channel="whatsapp"
        title="Edit Phone Number"
        inputPlaceholder="10-digit mobile number"
        inputKeyboard="phone-pad"
        sendLabel="Send OTP via WhatsApp"
        getSubtitle={(val) => `Code has been sent to ${val}`}
      />

      {/* ── Edit Email — Email OTP ──────────────────────────────────────── */}
      <OTPVerifySheet
        visible={showEditEmail}
        onClose={() => setShowEditEmail(false)}
        onSuccess={(newEmail) => {
          setEmail(newEmail);
          Alert.alert('Email Updated', 'Your email address has been updated successfully.');
        }}
        channel="email"
        title="Edit Email Address"
        inputPlaceholder="your@email.com"
        inputKeyboard="email-address"
        sendLabel="Send OTP via Email"
        getSubtitle={(val) => `Code has been sent to ${val}`}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SectionLabel (local utility)
// ─────────────────────────────────────────────────────────────────────────────
function SectionLabel({ title }: { title: string }) {
  return (
    <View style={ps.sectionLabelRow}>
      <View style={ps.sectionAccent} />
      <Text style={ps.sectionLabelText}>{title}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const ps = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: COLORS.pageBg },
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm, paddingVertical: 10,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn:     { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary },

  // ── Toast ──────────────────────────────────────────────────────────────────
  toast:      { backgroundColor: COLORS.brandPrimary },
  toastSaved: { backgroundColor: COLORS.positive },
  toastInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 12, paddingHorizontal: SPACING.md,
  },
  toastText: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.white },

  // ── Section label ──────────────────────────────────────────────────────────
  sectionLabelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 20, marginBottom: 10,
  },
  sectionAccent:    { width: 3, height: 13, borderRadius: 2, backgroundColor: COLORS.brandPrimary },
  sectionLabelText: {
    fontSize: 10, fontWeight: '800', color: COLORS.textTertiary, letterSpacing: 1.2,
  },

  // ── Card ──────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden',
  },
  hr: { height: 1, backgroundColor: COLORS.borderDefault, marginHorizontal: SPACING.md },

  // ── Fields ────────────────────────────────────────────────────────────────
  fieldWrap: { paddingHorizontal: SPACING.md, paddingTop: 14, paddingBottom: 10 },
  fieldLabel: {
    fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textTertiary,
    letterSpacing: 0.4, marginBottom: 7,
  },
  fieldInput: {
    fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, padding: 0, fontWeight: '500',
  },

  // Masked fields
  maskedRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'nowrap' },
  maskedValue:  { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, fontWeight: '500', flex: 1 },
  verifiedPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: COLORS.positiveBg, borderRadius: RADIUS.full,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: '#BBF7D0',
  },
  verifiedText: { fontSize: 10, color: COLORS.positive, fontWeight: '700' },
  editBtn:      { flexDirection: 'row', alignItems: 'center', gap: 1, paddingHorizontal: 6, paddingVertical: 4 },
  editBtnText:  { fontSize: TYPOGRAPHY.sm, color: COLORS.brandPrimary, fontWeight: '600' },

  // ── Security toggles ──────────────────────────────────────────────────────
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
  },
  toggleLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconBox:     {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  toggleLabel: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textPrimary },
  toggleSub:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },

  // ── Buttons ───────────────────────────────────────────────────────────────
  saveBtn: {
    marginTop: 20, backgroundColor: COLORS.brandPrimary,
    borderRadius: RADIUS.lg, paddingVertical: 16, alignItems: 'center',
  },
  saveBtnText: {
    fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.white, letterSpacing: 0.4,
  },

  deleteTextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 16, paddingVertical: 12,
  },
  deleteTextBtnLabel: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.negative },

  // ── Modal shared ──────────────────────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay },
  modalSheet: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: SPACING.lg, paddingTop: 12, paddingBottom: 8,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.borderStrong,
    alignSelf: 'center', marginBottom: 22,
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.lg, fontWeight: '800', color: COLORS.textPrimary,
    textAlign: 'center', marginBottom: 8,
  },
  modalSub: {
    fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary,
    textAlign: 'center', lineHeight: 20, marginBottom: 28,
  },
  changeLink: { color: COLORS.info, textDecorationLine: 'underline', fontWeight: '600' },

  // ── PIN Boxes ─────────────────────────────────────────────────────────────
  pinRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 14, marginBottom: 28,
  },
  pinBox: {
    width: 62, height: 62, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: COLORS.borderDefault,
    backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center',
  },
  pinBoxFilled: { borderColor: COLORS.brandPrimary, backgroundColor: COLORS.cardBg },
  pinDot:       { width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.brandPrimary },

  // ── Modal buttons ─────────────────────────────────────────────────────────
  modalBtn: {
    borderRadius: RADIUS.lg, paddingVertical: 16,
    alignItems: 'center', marginBottom: 4,
  },
  deleteBtnColor:  { backgroundColor: COLORS.negative },
  confirmBtnColor: { backgroundColor: COLORS.brandPrimary },
  btnDisabled:     { opacity: 0.30 },
  modalBtnText:    { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.white },

  resendRow: { alignItems: 'center', paddingVertical: 12, marginBottom: 10 },
  resendText: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },

  // ── Custom Toggle ─────────────────────────────────────────────────────────
  toggleTrack: {
    width: 50, height: 28, borderRadius: 14,
  },
  toggleThumb: {
    position: 'absolute',
    top: 2, width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 2,
    elevation: 2,
  },

  // ── Custom NumPad ─────────────────────────────────────────────────────────
  numPad: {
    borderWidth: 1, borderColor: COLORS.borderDefault,
    borderRadius: RADIUS.md, overflow: 'hidden',
    marginHorizontal: -4,
  },
  numRow: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  numKey: {
    flex: 1, height: 54,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.cardBg,
  },
  numKeyEmpty: {
    flex: 1, height: 54,
    backgroundColor: COLORS.pageBg,
  },
  numKeyBorderR: { borderRightWidth: 1, borderRightColor: COLORS.borderDefault },
  numKeyText:    { fontSize: TYPOGRAPHY.xl, fontWeight: '400', color: COLORS.textPrimary },

  // ── Step progress indicator ───────────────────────────────────────────────
  stepTrack: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 6, marginBottom: 14,
  },
  stepDot: {
    height: 6, width: 6, borderRadius: 3,
    backgroundColor: COLORS.borderStrong,
  },
  stepDotActive: {
    width: 22, backgroundColor: COLORS.brandPrimary, borderRadius: 3,
  },
  stepDotDone: {
    backgroundColor: COLORS.textTertiary,
  },

  // ── Edit Input (Phone & Email shared container) ───────────────────────────
  editInputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.borderDefault,
    borderRadius: RADIUS.md, backgroundColor: COLORS.pageBg,
    overflow: 'hidden', marginBottom: 20,
  },
  phonePre: {
    paddingHorizontal: 14, paddingVertical: 16,
    borderRightWidth: 1.5, borderRightColor: COLORS.borderDefault,
    backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center',
  },
  phonePreText: {
    fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary,
  },
  editInput: {
    flex: 1, paddingHorizontal: 14, paddingVertical: 16,
    fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary,
  },
});
