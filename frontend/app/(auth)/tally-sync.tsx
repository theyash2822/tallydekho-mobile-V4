import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View, Text, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

type SyncStep = 'prompt' | 'input' | 'syncing' | 'done';

export default function TallySyncScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [step, setStep] = useState<SyncStep>('prompt');
  const [pairKey, setPairKey] = useState('');
  const [progress, setProgress] = useState(0);

  const handleSync = async () => {
    if (!pairKey.trim()) return;
    setStep('syncing');
    // Simulate progress
    for (let i = 10; i <= 100; i += 10) {
      await new Promise(res => setTimeout(res, 200));
      setProgress(i);
    }
    await AsyncStorage.setItem('tally_synced', 'true');
    await signIn('mock_token_tally');
    // Navigation handled by _layout.tsx RootNavigation — shows guide on first login
  };

  const handleSkip = async () => {
    await AsyncStorage.setItem('tally_synced', 'false');
    await signIn('mock_token_skip');
    // Navigation handled by _layout.tsx RootNavigation — shows guide on first login
  };

  return (
    <SafeAreaView testID="tally-sync-screen" style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <View style={styles.container}>
          {/* Logo */}
          <View style={styles.logoBox}>
            <Ionicons name="stats-chart" size={28} color={COLORS.white} />
          </View>
          <Text style={styles.appName}>Tallydekho</Text>

          {step === 'prompt' && (
            <View style={styles.card}>
              <View style={styles.iconRow}>
                <View style={styles.syncIcon}>
                  <Ionicons name="sync" size={32} color={COLORS.positive} />
                </View>
              </View>
              <Text style={styles.heading}>Would you like to{'\n'}sync with Tally?</Text>
              <Text style={styles.subText}>
                Syncing with Tally ensures accurate, real-time financial data integration, keeping records up-to-date and business operations smooth.
              </Text>
              <TouchableOpacity
                testID="sync-tally-btn"
                style={styles.primaryBtn}
                onPress={() => setStep('input')}
                activeOpacity={0.8}
              >
                <Ionicons name="sync" size={18} color={COLORS.white} />
                <Text style={styles.primaryBtnText}>Sync with Tally</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="skip-sync-btn"
                style={styles.skipBtn}
                onPress={handleSkip}
                activeOpacity={0.7}
              >
                <Text style={styles.skipBtnText}>Skip</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 'input' && (
            <View style={styles.card}>
              <Text style={styles.heading}>Input Your Tally{'\n'}Pair Key</Text>
              <Text style={styles.subText}>Please check your tally application to see pair key</Text>
              <TextInput
                testID="pair-key-input"
                style={styles.input}
                placeholder="Enter pair key"
                placeholderTextColor={COLORS.textTertiary}
                value={pairKey}
                onChangeText={setPairKey}
                autoCapitalize="characters"
              />
              <TouchableOpacity
                testID="submit-pair-key-btn"
                style={[styles.primaryBtn, !pairKey.trim() && styles.primaryBtnDisabled]}
                onPress={handleSync}
                disabled={!pairKey.trim()}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryBtnText}>Submit</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="back-from-input-btn" style={styles.skipBtn} onPress={() => setStep('prompt')} activeOpacity={0.7}>
                <Text style={styles.skipBtnText}>Back</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 'syncing' && (
            <View style={styles.card}>
              <View style={styles.iconRow}>
                <ActivityIndicator size="large" color={COLORS.brandPrimary} />
              </View>
              <Text style={styles.heading}>Pairing with Tally...</Text>
              <Text style={styles.subText}>This might take a few minutes...</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressBar, { width: `${progress}%` as any }]} />
              </View>
              <Text style={styles.progressText}>{progress}%</Text>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  flex: { flex: 1 },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.md },
  logoBox: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: COLORS.brandPrimary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  appName: { fontSize: TYPOGRAPHY.lg, fontWeight: '800', color: COLORS.textPrimary, marginBottom: SPACING.xl },
  card: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.xl,
    padding: SPACING.lg, width: '100%',
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  iconRow: { alignItems: 'center', marginBottom: SPACING.md },
  syncIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: COLORS.positiveBg,
    alignItems: 'center', justifyContent: 'center',
  },
  heading: { fontSize: TYPOGRAPHY.xxl, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8, lineHeight: 36 },
  subText: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, lineHeight: 20, marginBottom: SPACING.lg },
  input: {
    height: 48, borderWidth: 1.5, borderColor: COLORS.borderDefault,
    borderRadius: RADIUS.md, paddingHorizontal: 14,
    fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary,
    backgroundColor: COLORS.pageBg, marginBottom: SPACING.md,
  },
  primaryBtn: {
    height: 52, backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
  },
  primaryBtnDisabled: { backgroundColor: COLORS.borderStrong },
  primaryBtnText: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
  skipBtn: { alignItems: 'center', paddingVertical: SPACING.md },
  skipBtnText: { fontSize: TYPOGRAPHY.base, color: COLORS.textSecondary, fontWeight: '500' },
  progressTrack: {
    height: 6, backgroundColor: COLORS.borderDefault, borderRadius: 3,
    marginBottom: 8, overflow: 'hidden', marginTop: SPACING.md,
  },
  progressBar: { height: '100%', backgroundColor: COLORS.brandPrimary, borderRadius: 3 },
  progressText: { textAlign: 'center', fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textPrimary },
});
