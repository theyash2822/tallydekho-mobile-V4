/**
 * Shared list search bar — Total Stock visual style + optional voice mic.
 * Use enableVoice={false} only for data-entry modals / form pickers.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Linking,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  Vibration,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';

import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/colors';
import { useVoiceSearch, type VoiceFailure } from '../hooks/useVoiceSearch';

/** An Alert raised while the listening Modal fades out is dropped on iOS; wait for it to close. */
const AFTER_MODAL_MS = 400;

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** Default true for list screens. Set false for data-entry modals. */
  enableVoice?: boolean;
  style?: ViewStyle;
  testID?: string;
  inputProps?: Omit<TextInputProps, 'value' | 'onChangeText' | 'placeholder' | 'placeholderTextColor' | 'style'>;
};

export default function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search...',
  enableVoice = true,
  style,
  testID,
  inputProps,
}: Props) {
  const { t } = useTranslation();
  const [showMicModal, setShowMicModal] = useState(false);
  const micScale = useState(() => new Animated.Value(1))[0];
  const micOpacity = useState(() => new Animated.Value(0.7))[0];
  const micAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const voiceStartedRef = useRef(false);
  const wasListeningRef = useRef(false);

  const {
    isListening: voiceListening,
    transcript: voiceTranscript,
    failure: voiceFailure,
    notice: voiceNotice,
    start: startVoice,
    stop: stopVoice,
    abort: abortVoice,
    getResultText,
  } = useVoiceSearch();

  /** Permission refused for good: only Settings helps. No recognizer: say so, with how to get one. */
  const showVoiceFailure = useCallback((failure: VoiceFailure) => {
    if (failure.reason === 'blocked') {
      Alert.alert(failure.message, failure.hint, [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('voiceSearch.openSettings'), onPress: () => { Linking.openSettings().catch(() => {}); } },
      ]);
    } else if (failure.reason === 'unavailable') {
      Alert.alert(failure.message, failure.hint);
    } else {
      Toast.show({ type: 'error', text1: failure.message, text2: failure.hint });
    }
  }, [t]);

  const stopMicAnimation = useCallback(() => {
    micAnimRef.current?.stop();
    micAnimRef.current = null;
    micScale.stopAnimation();
    micScale.setValue(1);
    micOpacity.stopAnimation();
    micOpacity.setValue(0.7);
  }, [micOpacity, micScale]);

  const startMicAnimation = useCallback(() => {
    stopMicAnimation();
    micAnimRef.current = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(micScale, { toValue: 1.4, duration: 700, useNativeDriver: true }),
          Animated.timing(micOpacity, { toValue: 0.15, duration: 700, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(micScale, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(micOpacity, { toValue: 0.7, duration: 700, useNativeDriver: true }),
        ]),
      ]),
    );
    micAnimRef.current.start();
  }, [micOpacity, micScale, stopMicAnimation]);

  const finishVoiceSession = useCallback(() => {
    voiceStartedRef.current = false;
    wasListeningRef.current = false;
    stopMicAnimation();
    setShowMicModal(false);
    const text = getResultText();
    if (text) {
      onChangeText(text);
    } else if (voiceFailure) {
      const failure = voiceFailure;
      setTimeout(() => showVoiceFailure(failure), AFTER_MODAL_MS);
    }
  }, [getResultText, onChangeText, stopMicAnimation, voiceFailure, showVoiceFailure]);

  const cancelVoiceModal = useCallback(() => {
    voiceStartedRef.current = false;
    wasListeningRef.current = false;
    abortVoice();
    stopMicAnimation();
    setShowMicModal(false);
  }, [abortVoice, stopMicAnimation]);

  useEffect(() => {
    if (voiceListening) wasListeningRef.current = true;
  }, [voiceListening]);

  // Done listening, or failed before it began (e.g. no recognizer for the language, Dictation off on iPhone).
  useEffect(() => {
    if (!showMicModal || voiceListening || !voiceStartedRef.current) return;
    if (!wasListeningRef.current && !voiceFailure) return;
    finishVoiceSession();
  }, [voiceListening, showMicModal, voiceFailure, finishVoiceSession]);

  useEffect(() => () => {
    abortVoice();
    stopMicAnimation();
  }, [abortVoice, stopMicAnimation]);

  // Permission prompts come first, so they never sit on top of the listening sheet.
  const handleMicPress = () => {
    Vibration.vibrate(80);
    setTimeout(async () => {
      wasListeningRef.current = false;
      const result = await startVoice();
      if (!result.ok) {
        showVoiceFailure(result.failure);
        return;
      }
      voiceStartedRef.current = true;
      setShowMicModal(true);
      startMicAnimation();
    }, 100);
  };

  const clear = () => {
    onChangeText('');
    cancelVoiceModal();
  };

  return (
    <>
      <View style={[styles.searchWrap, style]}>
        <Ionicons name="search-outline" size={16} color={COLORS.textTertiary} />
        <TextInput
          testID={testID}
          style={styles.searchInput}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textTertiary}
          value={value}
          onChangeText={onChangeText}
          returnKeyType="search"
          autoCorrect={false}
          {...inputProps}
        />
        {value.length > 0 ? (
          <TouchableOpacity onPress={clear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color={COLORS.textTertiary} />
          </TouchableOpacity>
        ) : enableVoice ? (
          <TouchableOpacity onPress={handleMicPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="mic-outline" size={16} color={COLORS.textTertiary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {enableVoice && (
        <Modal visible={showMicModal} transparent animationType="fade" onRequestClose={finishVoiceSession}>
          <TouchableOpacity style={styles.micBackdrop} activeOpacity={1} onPress={cancelVoiceModal}>
            <TouchableOpacity style={styles.micCard} activeOpacity={1} onPress={() => {}}>
              <View style={styles.micRingOuter}>
                <Animated.View style={[styles.micRingPulse, { transform: [{ scale: micScale }], opacity: micOpacity }]} />
                <View style={styles.micCircle}>
                  <Ionicons name="mic" size={32} color={COLORS.white} />
                </View>
              </View>
              <Text style={styles.micListeningText}>
                {voiceFailure
                  ? voiceFailure.message
                  : voiceListening
                    ? t('dashboard.listening', { defaultValue: 'Listening…' })
                    : t('dashboard.speakNow', { defaultValue: 'Speak now' })}
              </Text>
              <Text style={styles.micHint} numberOfLines={2}>
                {voiceTranscript || (voiceListening ? t('dashboard.speakNow', { defaultValue: 'Speak now' }) : '')}
              </Text>
              {voiceNotice ? <Text style={styles.micNotice}>{voiceNotice}</Text> : null}
              {voiceListening && (
                <TouchableOpacity style={styles.micStopBtn} onPress={() => stopVoice()} activeOpacity={0.7}>
                  <Text style={styles.micStopText}>
                    {t('dashboard.stopListening', { defaultValue: 'Stop' })}
                  </Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: SPACING.md,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
  },
  searchInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.textPrimary,
    padding: 0,
  },
  micBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  micCard: {
    width: '100%',
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 10,
  },
  micRingOuter: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  micRingPulse: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.brandPrimary,
  },
  micCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micListeningText: {
    fontSize: TYPOGRAPHY.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  micHint: {
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    minHeight: 20,
  },
  micNotice: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.warning,
    textAlign: 'center',
    lineHeight: 16,
  },
  micStopBtn: {
    marginTop: 8,
    backgroundColor: COLORS.brandPrimary,
    borderRadius: RADIUS.full,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  micStopText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.sm,
    fontWeight: '600',
  },
});
