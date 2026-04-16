import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Modal, Animated, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

// ─────────────────────────────────────────────────────────────────────────────
// HelpSheet — "Where do I find the code?"
// ─────────────────────────────────────────────────────────────────────────────
const STEPS = [
  'On your desktop where Tally is installed, open any browser and visit tallydekho.com',
  'Download the TallyDekho Desktop Application',
  'Run the setup file and complete the installation process',
  'Open the app and sync your company',
  'A 6-digit pairing code will appear in the TallyDekho desktop application',
];

function HelpSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={hs.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={hs.sheet}>
          <View style={hs.handle} />
          {/* Header */}
          <View style={hs.hdr}>
            <Text style={hs.title}>Where Do I Find The Code?</Text>
            <TouchableOpacity onPress={onClose} style={hs.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Icon */}
          <View style={hs.iconWrap}>
            <Ionicons name="desktop-outline" size={40} color={COLORS.brandPrimary} />
          </View>
          <Text style={hs.subtitle}>TallyDekho Desktop Agent</Text>

          {/* Steps */}
          <View style={hs.steps}>
            {STEPS.map((step, i) => (
              <View key={i} style={hs.stepRow}>
                <View style={hs.stepNum}>
                  <Text style={hs.stepNumTxt}>{i + 1}</Text>
                </View>
                <Text style={hs.stepTxt}>{step}</Text>
              </View>
            ))}
          </View>

          {/* Download button */}
          <TouchableOpacity
            style={hs.dlBtn}
            onPress={() => {
              Toast.show({ type: 'info', text1: 'Download', text2: 'Redirecting to tallydekho.com…' });
              onClose();
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="cloud-download-outline" size={18} color={COLORS.white} />
            <Text style={hs.dlBtnTxt}>Download Desktop App</Text>
          </TouchableOpacity>
          <View style={{ height: 24 }} />
        </View>
      </View>
    </Modal>
  );
}
const hs = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:   {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: SPACING.lg, paddingTop: 12,
    maxHeight: '85%',
  },
  handle:  { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.borderStrong, alignSelf: 'center', marginBottom: 16 },
  hdr:     { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  title:   { flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary },
  closeBtn:{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  iconWrap:{ alignItems: 'center', marginVertical: 16 },
  subtitle:{ fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textSecondary, textAlign: 'center', marginBottom: 20 },
  steps:   { gap: 14, marginBottom: 24 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepNum: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center',
    marginTop: 1, flexShrink: 0,
  },
  stepNumTxt: { fontSize: 11, fontWeight: '800', color: COLORS.white },
  stepTxt:    { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, lineHeight: 20 },
  dlBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md, paddingVertical: 15,
  },
  dlBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.white },
});

// ─────────────────────────────────────────────────────────────────────────────
// DisconnectSheet — confirmation
// ─────────────────────────────────────────────────────────────────────────────
function DisconnectSheet({
  visible, onClose, onConfirm,
}: { visible: boolean; onClose: () => void; onConfirm: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={ds.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={ds.sheet}>
          <View style={ds.handle} />
          <View style={ds.iconWrap}>
            <View style={ds.iconCircle}>
              <Ionicons name="unlink-outline" size={28} color={COLORS.negative} />
            </View>
          </View>
          <Text style={ds.title}>Disconnect Tally?</Text>
          <Text style={ds.sub}>You will need to re-pair your device to sync data again.</Text>
          <TouchableOpacity style={ds.disconnectBtn} onPress={onConfirm} activeOpacity={0.85}>
            <Ionicons name="unlink-outline" size={16} color={COLORS.white} />
            <Text style={ds.disconnectTxt}>Disconnect</Text>
          </TouchableOpacity>
          <TouchableOpacity style={ds.cancelBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={ds.cancelTxt}>Cancel</Text>
          </TouchableOpacity>
          <View style={{ height: 20 }} />
        </View>
      </View>
    </Modal>
  );
}
const ds = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:        { backgroundColor: COLORS.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: SPACING.lg, paddingTop: 12 },
  handle:       { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.borderStrong, alignSelf: 'center', marginBottom: 20 },
  iconWrap:     { alignItems: 'center', marginBottom: 14 },
  iconCircle:   { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
  title:        { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center', marginBottom: 8 },
  sub:          { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  disconnectBtn:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.negative, borderRadius: RADIUS.md, paddingVertical: 15, marginBottom: 10 },
  disconnectTxt:{ fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.white },
  cancelBtn:    { alignItems: 'center', paddingVertical: 14, backgroundColor: '#F3F4F6', borderRadius: RADIUS.md },
  cancelTxt:    { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
});

// ─────────────────────────────────────────────────────────────────────────────
// 6-digit OTP code input
// ─────────────────────────────────────────────────────────────────────────────
function OtpCodeInput({
  code, onChange,
}: { code: string[]; onChange: (code: string[]) => void }) {
  const refs = useRef<(TextInput | null)[]>(Array(6).fill(null));

  const handleChange = (text: string, idx: number) => {
    const digit = text.replace(/\D/g, '').slice(-1);
    const next = [...code];
    next[idx] = digit;
    onChange(next);
    if (digit && idx < 5) refs.current[idx + 1]?.focus();
  };

  const handleKey = (e: any, idx: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[idx] && idx > 0) {
      refs.current[idx - 1]?.focus();
      const next = [...code];
      next[idx - 1] = '';
      onChange(next);
    }
  };

  return (
    <View style={otp.row}>
      {code.map((digit, idx) => (
        <TextInput
          key={idx}
          ref={r => { refs.current[idx] = r; }}
          style={[otp.box, digit ? otp.boxFilled : null]}
          value={digit}
          onChangeText={t => handleChange(t, idx)}
          onKeyPress={e => handleKey(e, idx)}
          keyboardType="number-pad"
          maxLength={1}
          selectTextOnFocus
          selectionColor={COLORS.brandPrimary}
          // suppress web outline
          {...({ outlineStyle: 'none' } as any)}
        />
      ))}
    </View>
  );
}
const otp = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, justifyContent: 'center', marginVertical: SPACING.md },
  box: {
    width: 46, height: 54,
    borderRadius: RADIUS.md, borderWidth: 2,
    borderColor: COLORS.borderDefault,
    backgroundColor: COLORS.pageBg,
    textAlign: 'center',
    fontSize: TYPOGRAPHY.xxl ?? 24, fontWeight: '800',
    color: COLORS.textPrimary,
  },
  boxFilled: { borderColor: COLORS.brandPrimary, backgroundColor: COLORS.activeBg ?? COLORS.pageBg },
});

// ─────────────────────────────────────────────────────────────────────────────
// Awaiting dots animation
// ─────────────────────────────────────────────────────────────────────────────
function AwaitingDots() {
  const dots = [useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current];
  useEffect(() => {
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 220),
          Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 400, useNativeDriver: true }),
          Animated.delay((2 - i) * 220),
        ])
      )
    );
    animations.forEach(a => a.start());
    return () => animations.forEach(a => a.stop());
  }, []);
  return (
    <View style={aw.row}>
      {dots.map((dot, i) => (
        <Animated.View key={i} style={[aw.dot, { opacity: dot }]} />
      ))}
    </View>
  );
}
const aw = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, justifyContent: 'center', marginVertical: SPACING.lg },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.brandPrimary },
});

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────
const LAST_SYNCED = '15 Jun 2025, 11:42 AM';

export default function TallySyncScreen() {
  const router = useRouter();
  const [pairState, setPairState] = useState<'idle' | 'awaiting' | 'paired'>('idle');
  const [code, setCode]           = useState<string[]>(Array(6).fill(''));
  const [showHelp,       setShowHelp]       = useState(false);
  const [showDisconnect, setShowDisconnect] = useState(false);

  const codeStr = code.join('');
  const isComplete = codeStr.length === 6;

  const handlePair = () => {
    if (!isComplete) {
      Toast.show({ type: 'error', text1: 'Incomplete Code', text2: 'Please enter all 6 digits.' });
      return;
    }
    setPairState('awaiting');
    // Simulate pairing — replace with API call
    setTimeout(() => {
      setPairState('paired');
      Toast.show({ type: 'success', text1: 'Paired!', text2: 'TallyDekho is now connected.' });
    }, 2500);
  };

  const handleDisconnect = () => {
    setPairState('idle');
    setCode(Array(6).fill(''));
    setShowDisconnect(false);
    Toast.show({ type: 'info', text1: 'Disconnected', text2: 'Tally sync has been removed.' });
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.hdr}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Tally Prime Sync</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── Status banner (only when paired) ──────────────── */}
        {pairState === 'paired' && (
          <View style={s.pairedBanner}>
            <Ionicons name="checkmark-circle" size={22} color={COLORS.positive} />
            <View style={{ flex: 1 }}>
              <Text style={s.pairedTitle}>Tally Paired</Text>
              <Text style={s.pairedSub}>Last synced: {LAST_SYNCED}</Text>
            </View>
          </View>
        )}

        {/* ════════════════════════════════════════════════════
            PAIRED STATE
        ════════════════════════════════════════════════════ */}
        {pairState === 'paired' && (
          <View style={s.card}>
            {/* PC details */}
            <View style={s.deviceRow}>
              <View style={s.deviceIcon}>
                <Ionicons name="desktop-outline" size={28} color={COLORS.info} />
              </View>
              <View style={s.deviceInfo}>
                <Text style={s.deviceName}>ASHISH-PC \ TallyPrime</Text>
                <Text style={s.deviceSub}>Last seen: {LAST_SYNCED}</Text>
              </View>
            </View>
            {/* Disconnect only — no Sync Now */}
            <TouchableOpacity
              style={s.disconnectBtn}
              onPress={() => setShowDisconnect(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="unlink-outline" size={16} color={COLORS.negative} />
              <Text style={s.disconnectTxt}>Disconnect</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ════════════════════════════════════════════════════
            UNPAIRED / AWAITING STATE
        ════════════════════════════════════════════════════ */}
        {(pairState === 'idle' || pairState === 'awaiting') && (
          <View style={s.card}>
            <View style={s.cardHdr}>
              <Ionicons name="key-outline" size={18} color={COLORS.info} />
              <Text style={s.cardTitle}>Pair Device</Text>
            </View>
            <Text style={s.sub}>
              Open TallyDekho on your desktop and enter the 6-digit pairing code shown in the app.
            </Text>

            {/* ── IDLE: OTP boxes ── */}
            {pairState === 'idle' && (
              <>
                <OtpCodeInput code={code} onChange={setCode} />

                <TouchableOpacity
                  style={[s.primaryBtn, !isComplete && s.primaryBtnDisabled]}
                  onPress={handlePair}
                  activeOpacity={0.85}
                  disabled={!isComplete}
                >
                  <Ionicons name="link-outline" size={16} color={COLORS.white} />
                  <Text style={s.primaryTxt}>Pair Now</Text>
                </TouchableOpacity>
              </>
            )}

            {/* ── AWAITING: animated dots ── */}
            {pairState === 'awaiting' && (
              <View style={s.awaitingWrap}>
                <AwaitingDots />
                <Text style={s.awaitingTxt}>Awaiting Approval…</Text>
                <TouchableOpacity
                  style={s.cancelPairBtn}
                  onPress={() => { setPairState('idle'); setCode(Array(6).fill('')); }}
                  activeOpacity={0.7}
                >
                  <Text style={s.cancelPairTxt}>Cancel Pairing</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Help link — shown in both idle & awaiting */}
            <TouchableOpacity
              style={s.helpLink}
              onPress={() => setShowHelp(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="help-circle-outline" size={15} color={COLORS.brandPrimary} />
              <Text style={s.helpLinkTxt}>Where do I find the code?</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Info card ─────────────────────────────────────── */}
        <View style={s.infoCard}>
          <Ionicons name="information-circle-outline" size={18} color={COLORS.info} />
          <Text style={s.infoTxt}>
            Make sure TallyPrime is open and TallyDekho Desktop Agent is running to enable sync.
          </Text>
        </View>
      </ScrollView>

      {/* Sheets */}
      <HelpSheet       visible={showHelp}       onClose={() => setShowHelp(false)} />
      <DisconnectSheet visible={showDisconnect} onClose={() => setShowDisconnect(false)} onConfirm={handleDisconnect} />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.pageBg },
  hdr:    { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.sm, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  back:   { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title:  { flex: 1, fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  scroll: { padding: SPACING.md, paddingBottom: 40 },

  // Paired banner
  pairedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.positiveBg ?? '#ECFDF5',
    borderRadius: RADIUS.lg, padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1, borderColor: COLORS.positive,
  },
  pairedTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.positive },
  pairedSub:   { fontSize: TYPOGRAPHY.xs, color: COLORS.positive, opacity: 0.8, marginTop: 2 },

  // Card
  card:      { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  cardHdr:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.sm },
  cardTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  sub:       { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, lineHeight: 20, marginBottom: 4 },

  // Paired – device row
  deviceRow:  { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: SPACING.md, paddingBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  deviceIcon: { width: 52, height: 52, borderRadius: RADIUS.md, backgroundColor: COLORS.infoBg ?? '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  deviceInfo: { flex: 1 },
  deviceName: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  deviceSub:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 3 },
  disconnectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: COLORS.negative,
  },
  disconnectTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.negative },

  // Pair Now button
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 15, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary,
    marginTop: SPACING.sm,
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },

  // Awaiting
  awaitingWrap:  { alignItems: 'center', paddingVertical: SPACING.md },
  awaitingTxt:   { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textSecondary, marginTop: 4 },
  cancelPairBtn: {
    marginTop: SPACING.md, paddingVertical: 12, paddingHorizontal: 32,
    borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.borderStrong,
  },
  cancelPairTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },

  // Help hyperlink
  helpLink: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'center', marginTop: SPACING.md, paddingVertical: 4,
  },
  helpLinkTxt: {
    fontSize: TYPOGRAPHY.sm, fontWeight: '600',
    color: COLORS.brandPrimary,
    textDecorationLine: 'underline',
  },

  // Info card
  infoCard: { flexDirection: 'row', gap: 10, backgroundColor: COLORS.infoBg ?? '#EFF6FF', borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.info },
  infoTxt:  { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.info, lineHeight: 20 },
});
