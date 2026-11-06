import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { useTranslation } from 'react-i18next';

type PermissionResponse = { granted: boolean; canAskAgain?: boolean };

type StartOptions = { lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number };

type SpeechRecognitionModule = {
  isRecognitionAvailable: () => boolean;
  /** Android: speech recognizer services the app can see (always empty on iOS). */
  getSpeechRecognitionServices?: () => string[];
  /** iOS asks for speech recognition, then the microphone; Android for RECORD_AUDIO. */
  requestPermissionsAsync: () => Promise<PermissionResponse>;
  start: (options: StartOptions) => void;
  stop: () => void;
  abort: () => void;
  addListener: (eventName: string, listener: (event: any) => void) => { remove: () => void };
};

/**
 * Why voice search stopped or could not start. `expo-go`: the native module is missing (Expo Go);
 * `unavailable`: the phone has no speech recognizer; `blocked`: permission was refused for good, so only
 * the phone's Settings can turn it back on.
 */
export type VoiceFailureReason =
  | 'expo-go' | 'unavailable' | 'denied' | 'blocked' | 'no-speech' | 'network' | 'mic-busy' | 'failed';
export type VoiceFailure = { reason: VoiceFailureReason; message: string; hint?: string };
export type VoiceStartResult = { ok: true } | { ok: false; failure: VoiceFailure };

/** Null in Expo Go — does not throw unlike require('expo-speech-recognition'). */
const speechModule = requireOptionalNativeModule<SpeechRecognitionModule>('ExpoSpeechRecognition');

const FALLBACK_LANG = 'en-IN';
/** App language (i18next code) → recognition locale. */
const SPEECH_LANG: Record<string, string> = {
  en: 'en-IN', hi: 'hi-IN', bn: 'bn-IN', gu: 'gu-IN', kn: 'kn-IN', ml: 'ml-IN',
  mr: 'mr-IN', or: 'or-IN', pa: 'pa-IN', ta: 'ta-IN', te: 'te-IN',
};

export function speechLangFor(appLanguage?: string | null): string {
  const code = String(appLanguage || '').toLowerCase().split(/[-_]/)[0];
  return SPEECH_LANG[code] || FALLBACK_LANG;
}

const startOptions = (lang: string): StartOptions => ({
  lang, interimResults: true, continuous: false, maxAlternatives: 1,
});

/**
 * Only the search bar that started listening hears the recognizer: every mounted search bar subscribes to
 * the same native module, and one must not restart, abort or fill another's session.
 */
let sessionOwner: object | null = null;

/** Whether the phone has a speech recognizer, and on Android one the app is allowed to see. */
function recognizerAvailable(mod: SpeechRecognitionModule): boolean {
  try {
    if (!mod.isRecognitionAvailable()) return false;
    if (Platform.OS !== 'android' || typeof mod.getSpeechRecognitionServices !== 'function') return true;
    return mod.getSpeechRecognitionServices().length > 0;
  } catch {
    return false;
  }
}

/** Recognizer error codes (Web Speech API names, on both platforms) → what the user is told. */
function reasonForError(code?: string): VoiceFailureReason {
  switch (code) {
    case 'no-speech':
    case 'speech-timeout':
      return 'no-speech';
    case 'network':
      return 'network';
    case 'not-allowed':
      return 'denied';
    case 'service-not-allowed':
    case 'language-not-supported':
      return 'unavailable';
    case 'audio-capture':
    case 'busy':
      return 'mic-busy';
    default:
      return 'failed';
  }
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

function describeFailure(reason: VoiceFailureReason, t: Translate): VoiceFailure {
  switch (reason) {
    case 'expo-go':
      return { reason, message: t('voiceSearch.needsDevBuild') };
    case 'unavailable':
      return {
        reason,
        message: t('voiceSearch.unavailable'),
        hint: t(Platform.OS === 'ios' ? 'voiceSearch.unavailableHintIos' : 'voiceSearch.unavailableHintAndroid'),
      };
    case 'denied':
      return { reason, message: t('voiceSearch.permissionNeeded') };
    case 'blocked':
      return { reason, message: t('voiceSearch.permissionBlockedTitle'), hint: t('voiceSearch.permissionBlocked') };
    case 'no-speech':
      return { reason, message: t('voiceSearch.noSpeech') };
    case 'network':
      return { reason, message: t('voiceSearch.network') };
    case 'mic-busy':
      return { reason, message: t('voiceSearch.micBusy') };
    default:
      return { reason, message: t('voiceSearch.failed') };
  }
}

export function useVoiceSearch() {
  const { t, i18n } = useTranslation();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [failureReason, setFailureReason] = useState<VoiceFailureReason | null>(null);
  /** The app language has no recognizer on this phone, so this session listens in English. */
  const [fellBackToEnglish, setFellBackToEnglish] = useState(false);
  const finalTextRef = useRef('');
  const langRef = useRef(FALLBACK_LANG);
  /** Set between a language error and the English retry's start, so the failed attempt's end is ignored. */
  const restartingRef = useRef(false);
  const ownerRef = useRef({});

  useEffect(() => {
    if (!speechModule) return;
    const mine = () => sessionOwner === ownerRef.current;

    const subs = [
      speechModule.addListener('start', () => {
        if (!mine()) return;
        restartingRef.current = false;
        setIsListening(true);
        setFailureReason(null);
      }),
      speechModule.addListener('end', () => {
        if (!mine() || restartingRef.current) return;
        setIsListening(false);
      }),
      speechModule.addListener('result', (event: { results?: { transcript?: string }[]; isFinal?: boolean }) => {
        if (!mine()) return;
        const text = (event.results?.[0]?.transcript || '').trim();
        if (!text) return;
        setTranscript(text);
        if (event.isFinal) finalTextRef.current = text;
      }),
      speechModule.addListener('nomatch', () => {
        if (mine() && !finalTextRef.current) setFailureReason('no-speech');
      }),
      speechModule.addListener('error', (event: { error?: string }) => {
        if (!mine()) return;
        if (event.error === 'aborted') {
          restartingRef.current = false;
          setIsListening(false);
          return;
        }
        if (event.error === 'language-not-supported' && langRef.current !== FALLBACK_LANG) {
          langRef.current = FALLBACK_LANG;
          restartingRef.current = true;
          setFellBackToEnglish(true);
          try {
            speechModule.start(startOptions(FALLBACK_LANG));
            return;
          } catch {
            restartingRef.current = false;
          }
        }
        restartingRef.current = false;
        setIsListening(false);
        setFailureReason(reasonForError(event.error));
      }),
    ];

    return () => {
      subs.forEach((sub) => sub.remove());
    };
  }, []);

  /** Checks the recognizer and permissions, then listens; on failure nothing was started. */
  const start = useCallback(async (): Promise<VoiceStartResult> => {
    setTranscript('');
    setFailureReason(null);
    setFellBackToEnglish(false);
    finalTextRef.current = '';
    restartingRef.current = false;
    const fail = (reason: VoiceFailureReason): VoiceStartResult => ({ ok: false, failure: describeFailure(reason, t) });

    // Expo Go has no native speech module; a development or store build does.
    if (!speechModule) return fail('expo-go');
    if (!recognizerAvailable(speechModule)) return fail('unavailable');

    let permission: PermissionResponse;
    try {
      permission = await speechModule.requestPermissionsAsync();
    } catch {
      return fail('denied');
    }
    if (!permission.granted) return fail(permission.canAskAgain === false ? 'blocked' : 'denied');

    langRef.current = speechLangFor(i18n.resolvedLanguage || i18n.language);
    sessionOwner = ownerRef.current;
    try {
      speechModule.start(startOptions(langRef.current));
    } catch {
      sessionOwner = null;
      return fail('failed');
    }
    return { ok: true };
  }, [t, i18n]);

  const stop = useCallback(() => {
    if (sessionOwner !== ownerRef.current) return;
    try {
      speechModule?.stop();
    } catch {
      /* already stopped */
    }
  }, []);

  const abort = useCallback(() => {
    restartingRef.current = false;
    setIsListening(false);
    if (sessionOwner !== ownerRef.current) return;
    sessionOwner = null;
    try {
      speechModule?.abort();
    } catch {
      /* noop */
    }
  }, []);

  const getResultText = useCallback(() => {
    return (finalTextRef.current || transcript).trim();
  }, [transcript]);

  return {
    isListening,
    transcript,
    /** Why the last session ended without a result; null while listening or after a good one. */
    failure: failureReason ? describeFailure(failureReason, t) : null,
    /** Shown while listening when the app language had to fall back to English. */
    notice: fellBackToEnglish ? t('voiceSearch.languageFallback') : null,
    start,
    stop,
    abort,
    getResultText,
  };
}
