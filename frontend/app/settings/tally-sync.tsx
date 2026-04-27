import React, { useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Modal, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { ShimmerBox } from '../../src/components/Skeleton';

// Mock data
const MOCK_LAST_SYNCED = '15 Jun 2025, 11:42 AM';
const MOCK_PC_NAME = 'ASHISH-PC \\ TallyPrime';

// ─────────────────────────────────────────────────────────────────────────────
// HelpSheet — "Where do I find the code?"
// ─────────────────────────────────────────────────────────────────────────────
const HELP_STEPS = [
  'On your desktop, open any browser and visit tallydekho.com',
  'Download the TallyDekho Desktop Application',
  'Run the setup file and complete the installation',
  'Open the desktop app and sync your company',
  'A 6-digit pairing code will appear in the TallyDekho Desktop Agent',
];

function HelpSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={hs.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={hs.sheet}>
          <View style={hs.handle} />
          <View style={hs.hdr}>
            <Text style={hs.title}>Where Do I Find The Code?</Text>
            <TouchableOpacity onPress={onClose} style={hs.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={hs.iconWrap}>
            <View style={hs.iconCircle}>
              <Ionicons name="desktop-outline" size={32} color={COLORS.brandPrimary} />
            </View>
          </View>
          <Text style={hs.subtitle}>TallyDekho Desktop Agent</Text>
          <View style={hs.steps}>
            {HELP_STEPS.map((step, i) => (
              <View key={i} style={hs.stepRow}>
                <View style={hs.stepNum}>
                  <Text style={hs.stepNumTxt}>{i + 1}</Text>
                </View>
                <Text style={hs.stepTxt}>{step}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity
            style={hs.dlBtn}
            onPress={() => {
              Toast.show({ type: 'info', text1: 'Download', text2: 'Opening tallydekho.com…' });
              onClose();
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="cloud-download-outline" size={17} color={COLORS.white} />
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
  sheet:   { backgroundColor: COLORS.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: SPACING.lg, paddingTop: 12 },
  handle:  { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.borderStrong, alignSelf: 'center', marginBottom: 16 },
  hdr:     { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  title:   { flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary },
  closeBtn:{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  iconWrap:{ alignItems: 'center', marginTop: 12, marginBottom: 8 },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.activeBg, alignItems: 'center', justifyContent: 'center' },
  subtitle:{ fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textSecondary, textAlign: 'center', marginBottom: 20 },
  steps:   { gap: 14, marginBottom: 24 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0 },
  stepNumTxt: { fontSize: 11, fontWeight: '800', color: COLORS.white },
  stepTxt:    { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, lineHeight: 20 },
  dlBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md, paddingVertical: 15 },
  dlBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.white },
});

// ─────────────────────────────────────────────────────────────────────────────
// DisconnectSheet — confirmation bottom sheet
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
            <Text style={ds.disconnectTxt}>Yes, Disconnect</Text>
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
  cancelBtn:    { alignItems: 'center', paddingVertical: 14, backgroundColor: COLORS.activeBg, borderRadius: RADIUS.md },
  cancelTxt:    { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
});

// ─────────────────────────────────────────────────────────────────────────────
// 6-digit code input
// ─────────────────────────────────────────────────────────────────────────────
function SixDigitInput({
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
    <View style={ci.row}>
      {code.map((digit, idx) => (
        <TextInput
          key={idx}
          ref={r => { refs.current[idx] = r; }}
          style={[ci.box, digit ? ci.boxFilled : null]}
          value={digit}
          onChangeText={t => handleChange(t, idx)}
          onKeyPress={e => handleKey(e, idx)}
          keyboardType="number-pad"
          maxLength={1}
          selectTextOnFocus
          selectionColor={COLORS.brandPrimary}
          placeholder="-"
          placeholderTextColor={COLORS.textTertiary}
          {...({ outlineStyle: 'none' } as any)}
        />
      ))}
    </View>
  );
}
const ci = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: SPACING.sm },
  box: {
    width: 46, height: 56,
    borderRadius: RADIUS.md, borderWidth: 1.5,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.pageBg,
    textAlign: 'center',
    fontSize: 22, fontWeight: '800',
    color: COLORS.textPrimary,
  },
  boxFilled: { borderColor: COLORS.brandPrimary, backgroundColor: COLORS.activeBg },
});

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function TallySyncScreen() {
  const router = useRouter();
  const [pairState, setPairState] = useState<'idle' | 'awaiting' | 'paired'>('idle');
  const [isDirty, setIsDirty] = useState(false);
  const markDirty = () => setIsDirty(true);
  const [code, setCode]           = useState<string[]>(Array(6).fill(''));
  const [syncing, setSyncing]     = useState(false);
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
    setTimeout(async () => {
      setPairState('paired');
      await AsyncStorage.setItem('isTallyPaired', 'true');
      Toast.show({ type: 'success', text1: 'Tally Paired!', text2: 'TallyDekho is now connected.' });
    }, 2200);
  };

  const handleSyncNow = () => {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      Toast.show({ type: 'success', text1: 'Sync Complete', text2: 'All data has been synced.' });
    }, 2000);
  };

  const handleDisconnect = async () => {
    setPairState('idle');
    setCode(Array(6).fill(''));
    setShowDisconnect(false);
    await AsyncStorage.removeItem('isTallyPaired');
    Toast.show({ type: 'info', text1: 'Disconnected', text2: 'Tally sync has been removed.' });
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Screen Header */}
      <View style={s.hdr}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.hdrTitle}>Tally Prime Sync</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ════════════════════════════════════════════
            PAIRED STATE
        ════════════════════════════════════════════ */}
        {pairState === 'paired' && (
          <>
            {/* Paired status banner */}
            <View style={s.pairedBanner}>
              <Ionicons name="checkmark-circle" size={22} color={COLORS.positive} />
              <View style={{ flex: 1 }}>
                <Text style={s.pairedTitle}>Tally Paired</Text>
                <Text style={s.pairedSub}>Last synced: {MOCK_LAST_SYNCED}</Text>
              </View>
            </View>

            {/* PC details card */}
            <View style={s.card}>
              <View style={s.deviceRow}>
                <View style={s.deviceIconBox}>
                  <Ionicons name="desktop-outline" size={26} color={COLORS.brandPrimary} />
                </View>
                <View style={s.deviceInfo}>
                  <Text style={s.deviceName}>{MOCK_PC_NAME}</Text>
                  <Text style={s.deviceSub}>Last seen: {MOCK_LAST_SYNCED}</Text>
                  <View style={s.onlineRow}>
                    <View style={s.onlineDot} />
                    <Text style={s.onlineTxt}>Online</Text>
                  </View>
                </View>
              </View>

              {/* Action buttons */}
              <View style={s.btnRow}>
                <TouchableOpacity
                  style={s.disconnectBtn}
                  onPress={() => setShowDisconnect(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="unlink-outline" size={15} color={COLORS.negative} />
                  <Text style={s.disconnectTxt}>Disconnect</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.syncNowBtn, syncing && s.syncNowBtnDisabled]}
                  onPress={handleSyncNow}
                  activeOpacity={0.85}
                  disabled={syncing}
                >
                  {syncing
                    ? <ActivityIndicator size="small" color={COLORS.white} />
                    : <Ionicons name="sync-outline" size={15} color={COLORS.white} />
                  }
                  <Text style={s.syncNowTxt}>{syncing ? 'Syncing…' : 'Sync Now'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Info note */}
            <View style={s.infoCard}>
              <Ionicons name="information-circle-outline" size={17} color={COLORS.textSecondary} />
              <Text style={s.infoTxt}>
                Make sure TallyPrime is open and TallyDekho Desktop Agent is running to enable sync.
              </Text>
            </View>
          </>
        )}

        {/* ════════════════════════════════════════════
            UNPAIRED / AWAITING STATE
        ════════════════════════════════════════════ */}
        {(pairState === 'idle' || pairState === 'awaiting') && (
          <>
            <Text style={s.stepsHeader}>Follow the steps mentioned below</Text>

            {/* ── Step 1: Download ── */}
            <View style={s.stepCard}>
              <Text style={s.stepLabel}>Step 1</Text>

              {/* Tally logo box */}
              <View style={s.tallyLogoBox}>
                <Text style={s.tallyLogoText}>Tally</Text>
              </View>

              <Text style={s.stepBody}>
                Download{' '}
                <Text style={s.boldText}>TallyDekho</Text>
                {' '}Agent from{'\n'}
                <Text style={s.linkText}>https://www.tallydekho.com/download</Text>
              </Text>
            </View>

            {/* ── Step 2: Pairing instructions ── */}
            <View style={s.stepCard}>
              <Text style={s.stepLabel}>Step 2</Text>
              <Text style={s.stepTitle}>Pairing</Text>
              <Text style={s.stepInstr}>
                Open the TallyDekho Desktop Agent on your PC. A 6-digit pairing code will be displayed there.
              </Text>
              <Text style={[s.stepInstr, { marginTop: 8 }]}>
                Enter that code below in the Pair Device section to connect your account.
              </Text>
            </View>

            {/* ── Pair Device ── */}
            <Text style={s.pairDeviceHeader}>Pair Device</Text>

            <View style={s.pairCard}>
              {pairState === 'idle' ? (
                <>
                  <SixDigitInput code={code} onChange={setCode} />
                  <Text style={s.codeHint}>Enter 6-digit code from the TallyDekho Desktop Agent</Text>

                  <TouchableOpacity
                    style={[s.primaryBtn, !isComplete && s.primaryBtnDisabled]}
                    onPress={handlePair}
                    activeOpacity={0.85}
                    disabled={!isComplete}
                  >
                    <Text style={s.primaryTxt}>Pair Now</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={s.helpLink}
                    onPress={() => setShowHelp(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={s.helpLinkTxt}>Where do I find the code?</Text>
                  </TouchableOpacity>
                </>
              ) : (
                /* ── Awaiting state ── shimmer replaces the spinner */
                <View style={s.awaitingWrap}>
                  <ShimmerBox width={64} height={64} borderRadius={32} />
                  <View style={{ gap: 6, alignItems: 'center', marginTop: 16 }}>
                    <ShimmerBox height={16} width={180} borderRadius={6} />
                    <ShimmerBox height={11} width={230} borderRadius={5} />
                  </View>
                  <Text style={s.awaitingTxt}>Awaiting Pairing…</Text>
                  <Text style={s.awaitingSub}>Confirm on the TallyDekho Desktop Agent</Text>
                  <TouchableOpacity
                    style={s.cancelBtn}
                    onPress={() => { setPairState('idle'); setCode(Array(6).fill('')); }}
                    activeOpacity={0.7}
                  >
                    <Text style={s.cancelTxt}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </>
        )}

      </ScrollView>

      <HelpSheet       visible={showHelp}       onClose={() => setShowHelp(false)} />
      <DisconnectSheet visible={showDisconnect} onClose={() => setShowDisconnect(false)} onConfirm={handleDisconnect} />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.pageBg },
  hdr:     { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.sm, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  back:    { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  hdrTitle:{ flex: 1, fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  scroll:  { padding: SPACING.md, paddingBottom: 48 },

  // ── Paired ──────────────────────────────────────────────────────────────────
  pairedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.positiveBg,
    borderRadius: RADIUS.lg, padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1, borderColor: COLORS.positive,
  },
  pairedTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.positive },
  pairedSub:   { fontSize: 11, color: COLORS.positive, opacity: 0.85, marginTop: 2 },

  card: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },

  deviceRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: SPACING.md, paddingBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  deviceIconBox:{ width: 52, height: 52, borderRadius: RADIUS.md, backgroundColor: COLORS.activeBg, alignItems: 'center', justifyContent: 'center' },
  deviceInfo:   { flex: 1 },
  deviceName:   { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  deviceSub:    { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 3 },
  onlineRow:    { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  onlineDot:    { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.positive },
  onlineTxt:    { fontSize: TYPOGRAPHY.xs, color: COLORS.positive, fontWeight: '600' },

  btnRow:       { flexDirection: 'row', gap: 10 },
  disconnectBtn:{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 12, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.negative },
  disconnectTxt:{ fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.negative },
  syncNowBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 12, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary },
  syncNowBtnDisabled: { opacity: 0.5 },
  syncNowTxt:   { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.white },

  infoCard: { flexDirection: 'row', gap: 10, backgroundColor: COLORS.activeBg, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderStrong },
  infoTxt:  { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, lineHeight: 20 },

  // ── Unpaired ──────────────────────────────────────────────────────────────────
  stepsHeader:   { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '500', marginBottom: SPACING.sm },

  stepCard: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.borderDefault },
  stepLabel:{ fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary, fontWeight: '600', marginBottom: SPACING.sm },
  stepTitle:{ fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 12 },
  stepBody: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, lineHeight: 22, textAlign: 'center' },
  boldText: { fontWeight: '800', color: COLORS.textPrimary },
  linkText: { color: COLORS.brandPrimary, fontWeight: '600', textDecorationLine: 'underline' },
  stepInstr:{ fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, lineHeight: 20, marginTop: 10 },

  // Tally logo box
  tallyLogoBox: {
    alignSelf: 'center', marginVertical: 14,
    paddingHorizontal: 28, paddingVertical: 12,
    borderWidth: 1.5, borderColor: COLORS.borderStrong,
    borderRadius: RADIUS.md, backgroundColor: COLORS.cardBg,
  },
  tallyLogoText: { fontSize: 22, fontStyle: 'italic', fontWeight: '700', color: COLORS.brandPrimary, letterSpacing: 1 },

  // Pair Device
  pairDeviceHeader: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '600', marginBottom: SPACING.sm, marginTop: SPACING.sm },
  pairCard: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  codeHint:      { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, textAlign: 'center', marginBottom: 14 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 15, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary,
    marginBottom: SPACING.md,
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryTxt:    { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
  helpLink:      { alignItems: 'center', paddingVertical: 4 },
  helpLinkTxt:   { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.brandPrimary, textDecorationLine: 'underline' },

  // Awaiting
  awaitingWrap:  { alignItems: 'center', paddingVertical: SPACING.lg },
  awaitingTxt:   { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  awaitingSub:   { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, marginBottom: SPACING.lg },
  cancelBtn:     { paddingVertical: 12, paddingHorizontal: 32, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.borderStrong },
  cancelTxt:     { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
});
