import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, KeyboardAvoidingView, Platform, Alert,
  Modal, Animated, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useNavigationContainerRef, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { refreshPushRegistration } from '../../src/services/pushNotifications';
import { leaveForSignIn } from '../../src/utils/signOutNavigation';
import {
  updateMe, get2FAStatus, setPin as apiSetPin, removePin, setBiometric as apiSetBiometric, changePhone, changeEmail,
  startAccountDeletion, confirmAccountDeletion, ownedSharedWorkspaces, type OwnedSharedWorkspace,
} from '../../src/services/api';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTranslation } from 'react-i18next';
import { setBiometricPin, clearBiometricPin } from '../../src/utils/biometricPin';
import {
  PHONE_COUNTRIES, phoneCountryOf, nationalNumberOf, type PhoneCountry,
} from '../../src/constants/phoneCountries';

/** One-time codes are 6 digits; the security PIN stays 4 (PinBoxes default). */
const OTP_LENGTH = 6;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function maskPhone(phone: string): string {
  const local  = nationalNumberOf(phone);
  const first2 = local.slice(0, 2);
  const last2  = local.slice(-2);
  return `${phoneCountryOf(phone).code} ${first2}** **** ${last2}`;
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
  const anim = useState(() => new Animated.Value(value ? 1 : 0))[0];

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
  // Six boxes share the row width; the 4-digit PIN keeps its fixed boxes.
  const compact = length > 4;
  return (
    <View style={[ps.pinRow, compact && ps.otpRow]}>
      {Array.from({ length }).map((_, i) => (
        <View
          key={i}
          style={[compact ? ps.otpBox : ps.pinBox, i < value.length && ps.pinBoxFilled]}
        >
          {i < value.length && <View style={ps.pinDot} />}
        </View>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DeleteAccountModal — WhatsApp code to the account's number, then the server deletes the account
// ─────────────────────────────────────────────────────────────────────────────
const RESEND_SECONDS = 30;

function DeleteAccountModal({
  visible,
  onClose,
  onDeleted,
}: {
  visible: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { t } = useTranslation();
  const { expectSignOut } = useAuth();
  // sending: first code on its way · code: code entry · blocked: owns workspaces with members · failed: no code sent
  const [stage, setStage] = useState<'sending' | 'code' | 'blocked' | 'failed'>('sending');
  const [sendAttempt, setSendAttempt] = useState(0);
  const [maskedPhone, setMaskedPhone] = useState('');
  const [blocked, setBlocked] = useState<OwnedSharedWorkspace[]>([]);
  const [sendError, setSendError] = useState('');
  const [otp, setOtp] = useState('');
  const [codeError, setCodeError] = useState('');
  const [resending, setResending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [countdown, setCount] = useState(0);
  const canResend = countdown === 0 && !resending && !deleting;
  const codeComplete = otp.length === OTP_LENGTH;

  const [prevVisible, setPrevVisible] = useState(false);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) {
      setStage('sending'); setMaskedPhone(''); setSendError('');
      setOtp(''); setCodeError(''); setCount(0);
    }
  }

  // Opening the sheet sends the first code; Retry after a failed send asks again.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    startAccountDeletion()
      .then((res) => {
        if (cancelled) return;
        setMaskedPhone(res?.data?.masked_phone || '');
        setStage('code');
        setCount(RESEND_SECONDS);
      })
      .catch((err: any) => {
        if (cancelled) return;
        const owned = ownedSharedWorkspaces(err);
        if (owned) {
          setBlocked(owned);
          setStage('blocked');
        } else {
          setSendError(err?.message || '');
          setStage('failed');
        }
      });
    return () => { cancelled = true; };
  }, [visible, sendAttempt]);

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => setCount(s => s - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  const close = () => {
    if (!deleting) onClose();
  };

  const handleRetry = () => {
    setStage('sending');
    setSendError('');
    setSendAttempt(n => n + 1);
  };

  const handleResend = async () => {
    if (!canResend) return;
    setResending(true);
    setOtp('');
    setCodeError('');
    try {
      const res = await startAccountDeletion();
      if (res?.data?.masked_phone) setMaskedPhone(res.data.masked_phone);
      setCount(RESEND_SECONDS);
    } catch (err: any) {
      const owned = ownedSharedWorkspaces(err);
      if (owned) {
        setBlocked(owned);
        setStage('blocked');
      } else {
        setCodeError(err?.message || t('screens.settingsProfile.failedSendOtp'));
      }
    } finally {
      setResending(false);
    }
  };

  const handleKey = (key: string) => {
    if (resending || deleting) return;
    setCodeError('');
    if (key === 'back') setOtp(p => p.slice(0, -1));
    else setOtp(p => (p.length < OTP_LENGTH ? p + key : p));
  };

  const handleDelete = async () => {
    if (!codeComplete || deleting || resending) return;
    setDeleting(true);
    setCodeError('');
    // The server's `logout` for every session (this one too) can arrive before this answer: no "signed out" notice.
    expectSignOut();
    try {
      await confirmAccountDeletion(otp);
    } catch (err: any) {
      setDeleting(false);
      const owned = ownedSharedWorkspaces(err);
      if (owned) {
        setBlocked(owned);
        setStage('blocked');
        return;
      }
      // A refused code is cleared for re-entry; after a network failure the same code can be retried.
      if (err?.status === 400) setOtp('');
      setCodeError(err?.message || t('screens.settingsProfile.otpNoMatch'));
      return;
    }
    setDeleting(false);
    onDeleted();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={ps.modalOverlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={close} />
        <View style={ps.modalSheet}>
          <View style={ps.handle} />

          {/* Heading */}
          <Text style={ps.modalTitle}>{t('screens.settingsProfile.deleteAccountConfirmation')}</Text>
          <Text style={[ps.modalSub, ps.deleteSub]}>{t('screens.settingsProfile.deleteAccountSub')}</Text>

          {stage === 'sending' ? (
            <View style={ps.codeLoader}>
              <ActivityIndicator size="small" color={COLORS.textSecondary} />
            </View>
          ) : null}

          {stage === 'blocked' ? (
            <>
              <Text style={ps.deleteNotice}>
                {t('screens.settingsProfile.deleteBlocked', { names: blocked.map(w => w.name).join(', ') })}
              </Text>
              <TouchableOpacity style={[ps.modalBtn, ps.confirmBtnColor]} onPress={close} activeOpacity={0.85}>
                <Text style={ps.modalBtnText}>{t('common.close')}</Text>
              </TouchableOpacity>
              <View style={{ height: 16 }} />
            </>
          ) : null}

          {stage === 'failed' ? (
            <>
              <Text style={[ps.deleteNotice, ps.deleteNoticeError]}>
                {sendError || t('screens.settingsProfile.failedSendOtp')}
              </Text>
              <TouchableOpacity style={[ps.modalBtn, ps.confirmBtnColor]} onPress={handleRetry} activeOpacity={0.85}>
                <Text style={ps.modalBtnText}>{t('common.retry')}</Text>
              </TouchableOpacity>
              <View style={{ height: 16 }} />
            </>
          ) : null}

          {stage === 'code' ? (
            <>
              <Text style={ps.modalSub}>
                {t('screens.settingsProfile.codeSentToPrefix')}
                <Text style={{ color: COLORS.textPrimary, fontWeight: '700' }}>{maskedPhone}</Text>
                {t('screens.settingsProfile.viaWhatsAppSuffix')}
              </Text>

              {/* OTP boxes */}
              {resending ? (
                <View style={ps.codeLoader}>
                  <ActivityIndicator size="small" color={COLORS.textSecondary} />
                </View>
              ) : (
                <PinBoxes value={otp} length={OTP_LENGTH} />
              )}
              {codeError ? <Text style={ps.codeError}>{codeError}</Text> : null}

              {/* Delete button */}
              <TouchableOpacity
                style={[ps.modalBtn, ps.deleteBtnColor, !codeComplete && ps.btnDisabled]}
                onPress={handleDelete}
                activeOpacity={0.85}
                disabled={!codeComplete || deleting || resending}
              >
                {deleting
                  ? <ActivityIndicator size="small" color={COLORS.white} />
                  : <Text style={ps.modalBtnText}>{t('profile.deleteAccount')}</Text>}
              </TouchableOpacity>

              {/* Resend */}
              <TouchableOpacity
                style={ps.resendRow}
                onPress={handleResend}
                activeOpacity={canResend ? 0.7 : 1}
                disabled={!canResend}
              >
                <Text style={[ps.resendText, !canResend && { color: COLORS.textTertiary }]}>
                  {countdown > 0 ? t('auth.resendOtpTimer', { countdown }) : t('auth.resendOtp')}
                </Text>
              </TouchableOpacity>

              {/* Number pad */}
              <CustomNumPad onPress={handleKey} />
              <View style={{ height: 12 }} />
            </>
          ) : null}
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
  title,
  subtitle,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (pin: string) => void;
  title?: string;
  subtitle?: string;
}) {
  const { t } = useTranslation();
  const [pin, setPin] = useState('');

  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (!visible) setPin('');
  }

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
          <Text style={ps.modalTitle}>{title || t('screens.settingsProfile.createPasskey')}</Text>
          <Text style={ps.modalSub}>{subtitle || t('screens.settingsProfile.enterPasskey')}</Text>

          {/* PIN boxes */}
          <PinBoxes value={pin} />

          {/* Confirm button */}
          <TouchableOpacity
            style={[ps.modalBtn, ps.confirmBtnColor, pin.length < 4 && ps.btnDisabled]}
            onPress={() => pin.length === 4 && onConfirm(pin)}
            activeOpacity={0.85}
            disabled={pin.length < 4}
          >
            <Text style={ps.modalBtnText}>{t('common.confirm')}</Text>
          </TouchableOpacity>

          {/* Reset link */}
          <TouchableOpacity style={ps.resendRow} onPress={() => setPin('')} activeOpacity={0.7}>
            <Text style={[ps.resendText, { color: COLORS.info }]}>{t('screens.settingsProfile.resetPasscode')}</Text>
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
  phoneCountry = PHONE_COUNTRIES[0],
}: {
  visible:          boolean;
  onClose:          () => void;
  /** `revoked`: other devices a phone change signed out. */
  onSuccess:        (newValue: string, revoked?: number) => void;
  channel:          OTPChannel;
  title:            string;
  inputPlaceholder: string;
  inputKeyboard:    'phone-pad' | 'email-address';
  sendLabel:        string;
  getSubtitle:      (val: string) => string;
  /** Numbers are typed without the code, in the account's own country. */
  phoneCountry?:    PhoneCountry;
}) {
  const { t } = useTranslation();
  const isPhone      = inputKeyboard === 'phone-pad';
  const withCode     = (val: string) => `${phoneCountry.code}${val}`;
  const channelLabel = channel === 'whatsapp' ? 'WhatsApp' : t('profile.email');

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

  const [loading, setLoading] = React.useState(false);
  // Store verified OTP for current phone/email (used in phone step 2 call)
  const verifiedCurrentOtpRef = React.useRef('');

  const handleSendCurrentOTP = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (isPhone) {
        await changePhone({ step: 1, currentPhone: withCode(currentVal) });
      } else {
        await changeEmail({ step: 1, currentEmail: currentVal });
      }
      setOtp(''); setStep(2); startTimer();
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.message || t('screens.settingsProfile.failedSendOtp'));
    } finally { setLoading(false); }
  };

  const handleVerifyCurrentOTP = () => {
    // Just move to step 3 — actual verification happens in handleSendNewOTP
    if (otp.length < OTP_LENGTH) return;
    verifiedCurrentOtpRef.current = otp;
    setOtp(''); setStep(3);
  };

  const handleSendNewOTP = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (isPhone) {
        // Backend step 2: verify current OTP + send OTP to new phone
        await changePhone({
          step: 2, currentPhone: withCode(currentVal), otp: verifiedCurrentOtpRef.current, newPhone: withCode(newVal),
        });
      } else {
        // Email: step 1 already sent OTP to currentEmail; now send OTP to newEmail for verification
        await changeEmail({ step: 1, currentEmail: newVal });
      }
      setOtp(''); setStep(4); startTimer();
    } catch (err: any) {
      Alert.alert(
        err?.status === 429 ? t('screens.settingsProfile.tooManyAttempts') : err?.status === 400 ? t('screens.settingsProfile.invalidOtp') : t('common.error'),
        err?.message || t('screens.settingsProfile.failedSendOtpNew'),
      );
    } finally { setLoading(false); }
  };

  const handleVerifyNewOTP = async () => {
    if (otp.length < OTP_LENGTH || loading) return;
    setLoading(true);
    try {
      if (isPhone) {
        // Keep the number exactly as the account stores it (full international digits outside India).
        const res: any = await changePhone({ step: 3, otp });
        onSuccess(String(res?.data?.newPhone || newVal).trim(), Number(res?.data?.revoked) || 0);
      } else {
        await changeEmail({ step: 2, otp, newEmail: newVal });
        onSuccess(newVal.trim());
      }
      onClose();
    } catch (err: any) {
      Alert.alert(err?.status === 429 ? t('screens.settingsProfile.tooManyAttempts') : t('screens.settingsProfile.invalidOtp'), err?.message || t('screens.settingsProfile.otpNoMatch'));
    } finally { setLoading(false); }
  };

  const handleResend = () => {
    if (!canResend) return;
    startTimer();
    Alert.alert(t('screens.settingsProfile.otpResent'), t('screens.settingsProfile.newCodeSentVia', { channel: channelLabel }), [{ text: t('common.ok') }]);
  };

  const handleKey = (key: string) => {
    if (key === 'back') setOtp(p => p.slice(0, -1));
    else if (otp.length < OTP_LENGTH) setOtp(p => p + key);
  };

  const phoneOk = (val: string) => val.length >= phoneCountry.minDigits && val.length <= phoneCountry.maxDigits;
  const isCurrentValid = isPhone ? phoneOk(currentVal) : currentVal.includes('@') && currentVal.length > 5;
  const isNewValid     = isPhone ? phoneOk(newVal)     : newVal.includes('@')     && newVal.length > 5;

  const channelIcon: React.ReactNode =
    channel === 'whatsapp'
      ? <FontAwesome5 name="whatsapp" size={15} color="#25D366" />
      : <Ionicons name="mail-outline" size={15} color={COLORS.white} />;

  const stepTitles: Record<1|2|3|4, string> = {
    1: isPhone ? t('screens.settingsProfile.verifyCurrentNumber') : t('screens.settingsProfile.verifyCurrentEmail'),
    2: t('auth.enterOtp'),
    3: isPhone ? t('screens.settingsProfile.newPhoneNumber') : t('screens.settingsProfile.newEmailAddress'),
    4: t('screens.settingsProfile.confirmNewOtp'),
  };

  const displayCurrent = isPhone ? `${phoneCountry.code} ${currentVal}` : currentVal;
  const displayNew     = isPhone ? `${phoneCountry.code} ${newVal}`     : newVal;

  /* ── Input step (1 & 3) ──────────────────────────────── */
  const renderInput = (isCurrentStep: boolean) => {
    const val     = isCurrentStep ? currentVal : newVal;
    const setter  = isCurrentStep ? setCurrentVal : setNewVal;
    const canSend = isCurrentStep ? isCurrentValid : isNewValid;
    const onSend  = isCurrentStep ? handleSendCurrentOTP : handleSendNewOTP;
    const subTitle = isCurrentStep
      ? (isPhone ? t('screens.settingsProfile.enterCurrentPhone') : t('screens.settingsProfile.enterCurrentEmail'))
      : (isPhone ? t('screens.settingsProfile.enterNewPhone') : t('screens.settingsProfile.enterNewEmail'));

    return (
      <View>
        <Text style={ps.modalSub}>{subTitle}</Text>

        {/* Input row */}
        <View style={ps.editInputWrap}>
          {isPhone && (
            <View style={ps.phonePre}>
              <Text style={ps.phonePreText}>{phoneCountry.code}</Text>
            </View>
          )}
          <TextInput
            style={ps.editInput}
            value={val}
            onChangeText={text =>
              isPhone ? setter(text.replace(/[^0-9]/g, '').slice(0, phoneCountry.maxDigits)) : setter(text)
            }
            placeholder={inputPlaceholder}
            placeholderTextColor={COLORS.textTertiary}
            keyboardType={inputKeyboard}
            autoCapitalize="none"
            autoFocus
            maxLength={isPhone ? phoneCountry.maxDigits : 80}
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
          <Text style={[ps.resendText, { color: COLORS.textTertiary }]}>{t('common.cancel')}</Text>
        </TouchableOpacity>
        <View style={{ height: 16 }} />
      </View>
    );
  };

  /* ── OTP step (2 & 4) ────────────────────────────────── */
  const renderOTP = (isCurrentStep: boolean) => {
    const display   = isCurrentStep ? displayCurrent : displayNew;
    const onVerify  = isCurrentStep ? handleVerifyCurrentOTP : handleVerifyNewOTP;
    const btnLabel  = isCurrentStep ? t('screens.settingsProfile.verifyContinue') : t('screens.settingsProfile.verifyUpdate');
    const canVerify = otp.length === OTP_LENGTH;

    return (
      <View>
        <Text style={ps.modalSub}>
          {getSubtitle(display)}{'\n'}
          <Text style={{ fontWeight: '700', color: channel === 'whatsapp' ? '#25D366' : COLORS.brandPrimary }}>
            {t('screens.settingsProfile.viaChannel', { channel: channelLabel })}
          </Text>
        </Text>

        {/* OTP boxes */}
        <PinBoxes value={otp} length={OTP_LENGTH} />

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
              {t('screens.settingsProfile.didntReceive')}
            </Text>
          ) : (
            <Text style={[ps.resendText, { color: COLORS.textTertiary }]}>
              {t('screens.settingsProfile.resendIn', { countdown })}
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
      <View style={{ flex: 1, backgroundColor: COLORS.overlay }}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
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
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}


export default function ProfileScreen() {
  const router = useRouter();
  const navigationRef = useNavigationContainerRef();
  const { t } = useTranslation();
  const { user, setUser, signOut } = useAuth();
  /** A PIN or phone change signs every other device out; the answer says how many. */
  const othersSignedOut = (revoked: unknown) => {
    const count = Number(revoked) || 0;
    return count > 0 ? t('auth.otherDevicesSignedOut', { count }) : null;
  };

  // Form state — pre-filled from AuthContext
  const [name,  setName]  = useState(user?.name || 'Your Name');
  const [role,  setRole]  = useState('Admin');
  const [phone, setPhone] = useState(user?.phone || '');
  const ownPhoneCountry = phoneCountryOf(phone);
  const [email, setEmail] = useState(user?.email || 'your@email.com');

  // Sync when user data loads
  const [prevUser, setPrevUser] = useState(user);
  if (user !== prevUser) {
    setPrevUser(user);
    if (user?.name) setName(user.name);
    if (user?.phone) setPhone(user.phone);
  }

  // Security — loaded from API
  const [biometric, setBiometricState] = useState(false);
  const [twoFA,     setTwoFA]          = useState(false);
  const [pinForDisable, setPinForDisable] = useState('');
  const [showDisable2FA, setShowDisable2FA] = useState(false);

  // Load 2FA status on mount
  useEffect(() => {
    get2FAStatus().then((res: any) => {
      if (res?.status) {
        setTwoFA(res.data?.two_fa_enabled || false);
        setBiometricState(res.data?.biometric_enabled || false);
      }
    }).catch(() => {});
  }, []);

  const handleBiometricToggle = async (val: boolean) => {
    if (val) {
      // Verify biometric hardware is available
      const hasHW = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHW || !enrolled) {
        Toast.show({ type: 'error', text1: t('screens.settingsProfile.biometricNotAvailable'), text2: t('screens.settingsProfile.biometricSetupFirst') });
        return;
      }
      // Prompt biometric to confirm user's identity before enabling
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t('screens.settingsProfile.confirmIdentity'),
        cancelLabel: t('common.cancel'),
        disableDeviceFallback: false,
      });
      if (!result.success) {
        Toast.show({ type: 'info', text1: t('screens.settingsProfile.cancelled'), text2: t('screens.settingsProfile.biometricNotEnabled') });
        return;
      }
      // Store PIN securely for biometric auto-login (if 2FA is set)
      if (twoFA) {
        Toast.show({ type: 'info', text1: t('auth.enterPin'), text2: t('screens.settingsProfile.enterPinOnce') });
        // setShowPasskey flow will handle saving PIN to SecureStore
        setShowPasskey(true);
        // We set biometric after PIN is confirmed via handlePasskeyConfirm
        return;
      }
    } else {
      // Disabling biometric — clear stored PIN
      await clearBiometricPin(phone);
    }
    setBiometricState(val);
    try {
      await apiSetBiometric(val);
    } catch {
      setBiometricState(!val); // revert
      Toast.show({ type: 'error', text1: t('common.error'), text2: t('screens.settingsProfile.couldNotUpdateBiometric') });
    }
  };

  // Modals
  const [showDelete,    setShowDelete]    = useState(false);
  const [showPasskey,   setShowPasskey]   = useState(false);
  const [showEditPhone, setShowEditPhone] = useState(false);
  const [showEditEmail, setShowEditEmail] = useState(false);

  // The server has already ended every session, so the logout call inside signOut may fail;
  // signOut clears this device either way. Nothing of the deleted account may stay under the sign-in screen.
  const handleAccountDeleted = async () => {
    setShowDelete(false);
    await clearBiometricPin(phone);
    await signOut().catch(() => {});
    leaveForSignIn(router, navigationRef);
    setTimeout(() => {
      Alert.alert(t('screens.settingsProfile.accountDeleted'), t('screens.settingsProfile.accountDeletedMsg'));
    }, 300);
  };

  // markDirty — kept as no-op since Save button is always visible on this screen
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const markDirty = () => {};

  // Save toast animation (slidedown below header)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const toastH    = useState(() => new Animated.Value(0))[0];
  const toastOpac = useState(() => new Animated.Value(0))[0];

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

  const handleSave = async () => {
    showToast('saving');
    try {
      await updateMe({ name: name.trim(), email: email.trim() });
      if (user) setUser({ ...user, name: name.trim(), email: email.trim() });
      showToast('saved');
      setTimeout(hideToast, 1600);
    } catch {
      hideToast();
      Toast.show({ type: 'error', text1: t('profile.saveFailed'), text2: t('screens.settingsProfile.couldNotUpdateProfile') });
    }
  };

  const handle2FAToggle = (val: boolean) => {
    if (val) {
      setShowPasskey(true);
    } else {
      // Ask for current PIN before disabling
      setShowDisable2FA(true);
    }
  };

  const handlePasskeyConfirm = async (pin: string) => {
    setShowPasskey(false);
    // With 2FA already on, this sheet confirms the existing PIN for biometric unlock rather than replacing it.
    const confirmingExisting = twoFA;
    let othersOut: string | null = null;
    try {
      const res: any = await apiSetPin(pin, confirmingExisting ? pin : undefined);
      othersOut = othersSignedOut(res?.data?.revoked);
      // Ending the other sessions dropped every push token not tied to this one.
      refreshPushRegistration();
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: err?.status === 429 ? t('screens.settingsProfile.tooManyAttempts')
          : err?.code === 'PIN_INVALID' ? t('screens.settingsProfile.incorrectPin')
          : t('common.error'),
        text2: err?.message || t('screens.settingsProfile.couldNotSetPasskey'),
      });
      return;
    }
    setTwoFA(true);

    // Keep the PIN on this device for biometric auto-login; 2FA stays on even if that fails.
    let savedForBiometric = false;
    try {
      const hasHW = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (hasHW && enrolled) {
        await setBiometricPin(phone, pin);
        savedForBiometric = true;
      }
    } catch { /* biometric unlock stays off */ }
    if (savedForBiometric && !biometric) {
      await apiSetBiometric(true).catch(() => {});
      setBiometricState(true);
    }

    if (!confirmingExisting) {
      Toast.show({ type: 'success', text1: t('screens.settingsProfile.passkeySet'), text2: othersOut || t('screens.settingsProfile.twoFaEnabled') });
    } else if (savedForBiometric) {
      Toast.show({ type: 'success', text1: t('profile.biometricScreenLock'), text2: othersOut || t('screens.settingsProfile.biometricEnabled') });
    } else {
      Toast.show({ type: 'error', text1: t('common.error'), text2: t('screens.settingsProfile.couldNotUpdateBiometric') });
    }
  };

  const handleDisable2FA = async (pin: string) => {
    setShowDisable2FA(false);
    try {
      await removePin(pin);
      setTwoFA(false);
      // Clear stored biometric PIN
      await clearBiometricPin(phone);
      setBiometricState(false);
      Toast.show({ type: 'success', text1: t('screens.settingsProfile.twoFaDisabled'), text2: t('screens.settingsProfile.twoFaTurnedOff') });
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: err?.status === 429 ? t('screens.settingsProfile.tooManyAttempts') : t('screens.settingsProfile.incorrectPin'),
        text2: err?.message || t('screens.settingsProfile.couldNotDisable2fa'),
      });
    }
  };

  return (
    <SafeAreaView style={ps.safe} edges={['top', 'left', 'right']}>
      {/* ── Nav Header ─────────────────────────────────────────────────── */}
      <View style={ps.header}>
        <TouchableOpacity style={ps.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={ps.headerTitle}>{t('profile.title')}</Text>
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
              <Text style={ps.toastText}>{t('settings.savingChanges')}</Text>
            </>
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={16} color={COLORS.white} />
              <Text style={ps.toastText}>{t('settings.savedSuccessfully')}</Text>
            </>
          )}
        </View>
      </Animated.View>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          style={ps.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={ps.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Personal Info ────────────────────────────────────────── */}
          <SectionLabel title={t('profile.personalInfo').toUpperCase()} />
          <View style={ps.card}>
            {/* Full Name */}
            <View style={ps.fieldWrap}>
              <Text style={ps.fieldLabel}>{t('profile.fullName')}</Text>
              <TextInput
                style={ps.fieldInput}
                value={name}
                onChangeText={v => { setName(v); markDirty(); }}
                placeholder={t('screens.settingsProfile.enterYourName')}
                placeholderTextColor={COLORS.textTertiary}
                selectionColor={COLORS.brandPrimary}
                returnKeyType="next"
              />
            </View>

            <View style={ps.hr} />

            {/* Role — read-only, set by backend */}
            <View style={ps.fieldWrap}>
              <Text style={ps.fieldLabel}>{t('profile.role')}</Text>
              <Text style={ps.fieldInput}>{role}</Text>
            </View>

            <View style={ps.hr} />

            {/* Phone (masked) */}
            <View style={ps.fieldWrap}>
              <Text style={ps.fieldLabel}>{t('profile.phoneNumber')}</Text>
              <View style={ps.maskedRow}>
                <Text style={ps.maskedValue}>{maskPhone(phone)}</Text>
                <View style={ps.verifiedPill}>
                  <Ionicons name="checkmark-circle" size={12} color={COLORS.positive} />
                  <Text style={ps.verifiedText}>{t('screens.settingsProfile.verified')}</Text>
                </View>
                <TouchableOpacity
                  style={ps.editBtn}
                  onPress={() => setShowEditPhone(true)}
                  activeOpacity={0.7}
                >
                  <Text style={ps.editBtnText}>{t('common.edit')}</Text>
                  <Ionicons name="chevron-forward" size={11} color={COLORS.brandPrimary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={ps.hr} />

            {/* Email (masked) */}
            <View style={[ps.fieldWrap, { paddingBottom: 16 }]}>
              <Text style={ps.fieldLabel}>{t('profile.email')}</Text>
              <View style={ps.maskedRow}>
                <Text style={ps.maskedValue}>{maskEmail(email)}</Text>
                <View style={ps.verifiedPill}>
                  <Ionicons name="checkmark-circle" size={12} color={COLORS.positive} />
                  <Text style={ps.verifiedText}>{t('screens.settingsProfile.verified')}</Text>
                </View>
                <TouchableOpacity
                  style={ps.editBtn}
                  onPress={() => setShowEditEmail(true)}
                  activeOpacity={0.7}
                >
                  <Text style={ps.editBtnText}>{t('common.edit')}</Text>
                  <Ionicons name="chevron-forward" size={11} color={COLORS.brandPrimary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* ── Security ─────────────────────────────────────────────── */}
          <SectionLabel title={t('profile.security').toUpperCase()} />
          <View style={ps.card}>
            {/* Biometric */}
            <View style={ps.toggleRow}>
              <View style={ps.toggleLeft}>
                <View style={ps.iconBox}>
                  <Ionicons name="finger-print-outline" size={17} color={COLORS.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ps.toggleLabel}>{t('profile.biometricScreenLock')}</Text>
                  <Text style={ps.toggleSub}>{t('profile.biometricSub')}</Text>
                </View>
              </View>
              <CustomToggle value={biometric} onValueChange={handleBiometricToggle} />
            </View>

            <View style={ps.hr} />

            {/* PassKey 2FA */}
            <View style={[ps.toggleRow, { borderBottomWidth: 0 }]}>
              <View style={ps.toggleLeft}>
                <View style={ps.iconBox}>
                  <Ionicons name="key-outline" size={17} color={COLORS.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ps.toggleLabel}>{t('profile.passkey')}</Text>
                  <Text style={ps.toggleSub}>
                    {twoFA ? t('profile.passkeyActive') : t('profile.passkeySub')}
                  </Text>
                </View>
              </View>
              <CustomToggle value={twoFA} onValueChange={handle2FAToggle} />
            </View>
          </View>

          {/* ── Save Button ───────────────────────────────────────────── */}
          <TouchableOpacity style={ps.saveBtn} onPress={handleSave} activeOpacity={0.85}>
            <Text style={ps.saveBtnText}>{t('profile.saveChanges')}</Text>
          </TouchableOpacity>

          {/* ── Delete Account ────────────────────────────────────────── */}
          <TouchableOpacity
            style={ps.deleteTextBtn}
            onPress={() => setShowDelete(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={14} color={COLORS.negative} />
            <Text style={ps.deleteTextBtnLabel}>{t('profile.deleteAccount')}</Text>
          </TouchableOpacity>

          <View style={{ height: 50 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Modals ─────────────────────────────────────────────────────── */}
      <DeleteAccountModal
        visible={showDelete}
        onClose={() => setShowDelete(false)}
        onDeleted={handleAccountDeleted}
      />
      <CreatePasskeyModal
        visible={showPasskey}
        onClose={() => setShowPasskey(false)}
        onConfirm={handlePasskeyConfirm}
        title={twoFA ? t('screens.authVerifyPin.heading') : undefined}
        subtitle={twoFA ? t('screens.settingsProfile.enterPinOnce') : undefined}
      />
      {/* Disable 2FA — requires current PIN */}
      <CreatePasskeyModal
        visible={showDisable2FA}
        onClose={() => setShowDisable2FA(false)}
        onConfirm={handleDisable2FA}
        title={t('screens.authVerifyPin.heading')}
        subtitle={t('screens.settingsProfile.enterPasskeyToTurnOff')}
      />

      {/* ── Edit Phone — WhatsApp OTP ───────────────────────────────────── */}
      <OTPVerifySheet
        visible={showEditPhone}
        onClose={() => setShowEditPhone(false)}
        onSuccess={(newPhone, revoked) => {
          setPhone(newPhone);
          if (user) setUser({ ...user, phone: newPhone });
          Toast.show({
            type: 'success',
            text1: t('profile.phoneUpdated'),
            text2: othersSignedOut(revoked) || t('screens.settingsProfile.phoneChanged'),
            visibilityTime: 3000,
          });
          // Ending the other sessions dropped every push token not tied to this one.
          refreshPushRegistration();
        }}
        channel="whatsapp"
        title={t('profile.editPhone')}
        inputPlaceholder={
          ownPhoneCountry === PHONE_COUNTRIES[0] ? t('screens.settingsProfile.tenDigitMobile') : ownPhoneCountry.placeholder
        }
        inputKeyboard="phone-pad"
        sendLabel={t('auth.sendOtp')}
        getSubtitle={(val) => t('auth.codeSentTo', { phone: val })}
        phoneCountry={ownPhoneCountry}
      />

      {/* ── Edit Email — Email OTP ──────────────────────────────────────── */}
      <OTPVerifySheet
        visible={showEditEmail}
        onClose={() => setShowEditEmail(false)}
        onSuccess={(newEmail) => {
          setEmail(newEmail);
          if (user) setUser({ ...user, email: newEmail });
          Toast.show({
            type: 'success',
            text1: t('profile.emailUpdated'),
            text2: t('screens.settingsProfile.emailChanged'),
            visibilityTime: 3000,
          });
        }}
        channel="email"
        title={t('profile.editEmail')}
        inputPlaceholder="your@email.com"
        inputKeyboard="email-address"
        sendLabel={t('screens.settingsProfile.sendOtpEmail')}
        getSubtitle={(val) => t('auth.codeSentTo', { phone: val })}
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
  scrollContent: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, paddingBottom: 180 },

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
  deleteSub: { marginBottom: 16 },
  deleteNotice: {
    fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, fontWeight: '600',
    textAlign: 'center', lineHeight: 20, marginBottom: 20,
  },
  deleteNoticeError: { color: COLORS.negative },
  codeLoader: { height: 52, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  codeError: {
    fontSize: TYPOGRAPHY.sm, color: COLORS.negative,
    textAlign: 'center', marginTop: -16, marginBottom: 16,
  },

  // ── PIN Boxes ─────────────────────────────────────────────────────────────
  pinRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 14, marginBottom: 28,
  },
  pinBox: {
    width: 62, height: 62, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: COLORS.borderDefault,
    backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center',
  },
  otpRow: { gap: 8 },
  otpBox: {
    flex: 1, maxWidth: 52, aspectRatio: 1, borderRadius: RADIUS.md,
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
