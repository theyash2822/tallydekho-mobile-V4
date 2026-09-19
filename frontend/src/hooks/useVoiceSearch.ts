import { useCallback, useEffect, useRef, useState } from 'react';
import { requireOptionalNativeModule } from 'expo-modules-core';

type SpeechRecognitionModule = {
  isRecognitionAvailable: () => boolean;
  requestPermissionsAsync: () => Promise<{ granted: boolean }>;
  start: (options: {
    lang: string;
    interimResults: boolean;
    continuous: boolean;
    maxAlternatives: number;
  }) => void;
  stop: () => void;
  abort: () => void;
  addListener: (eventName: string, listener: (event: any) => void) => { remove: () => void };
};

const DEV_BUILD_MSG =
  'Voice search needs a development build (not Expo Go). Run: npx expo run:ios';

/** Null in Expo Go — does not throw unlike require('expo-speech-recognition'). */
const speechModule = requireOptionalNativeModule<SpeechRecognitionModule>('ExpoSpeechRecognition');

export function useVoiceSearch() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const finalTextRef = useRef('');
  const subsRef = useRef<Array<{ remove: () => void }>>([]);

  useEffect(() => {
    if (!speechModule) return;

    subsRef.current = [
      speechModule.addListener('start', () => {
        setIsListening(true);
        setError(null);
      }),
      speechModule.addListener('end', () => {
        setIsListening(false);
      }),
      speechModule.addListener('result', (event: { results?: Array<{ transcript?: string }>; isFinal?: boolean }) => {
        const text = (event.results?.[0]?.transcript || '').trim();
        if (!text) return;
        setTranscript(text);
        if (event.isFinal) finalTextRef.current = text;
      }),
      speechModule.addListener('error', (event: { error?: string; message?: string }) => {
        setIsListening(false);
        if (event.error === 'aborted') return;
        setError(event.message || 'Could not recognize speech. Try again.');
      }),
    ];

    return () => {
      subsRef.current.forEach((sub) => sub.remove());
      subsRef.current = [];
    };
  }, []);

  const start = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    setTranscript('');
    setError(null);
    finalTextRef.current = '';

    if (!speechModule) {
      setError(DEV_BUILD_MSG);
      return { ok: false, error: DEV_BUILD_MSG };
    }

    try {
      if (!speechModule.isRecognitionAvailable()) {
        setError(DEV_BUILD_MSG);
        return { ok: false, error: DEV_BUILD_MSG };
      }
    } catch {
      setError(DEV_BUILD_MSG);
      return { ok: false, error: DEV_BUILD_MSG };
    }

    const perm = await speechModule.requestPermissionsAsync();
    if (!perm.granted) {
      const msg = 'Microphone permission is required for voice search.';
      setError(msg);
      return { ok: false, error: msg };
    }

    speechModule.start({
      lang: 'en-IN',
      interimResults: true,
      continuous: false,
      maxAlternatives: 1,
    });
    return { ok: true };
  }, []);

  const stop = useCallback(() => {
    try {
      speechModule?.stop();
    } catch {
      /* already stopped */
    }
  }, []);

  const abort = useCallback(() => {
    try {
      speechModule?.abort();
    } catch {
      /* noop */
    }
    setIsListening(false);
  }, []);

  const getResultText = useCallback(() => {
    return (finalTextRef.current || transcript).trim();
  }, [transcript]);

  return {
    isListening,
    transcript,
    error,
    start,
    stop,
    abort,
    getResultText,
  };
}
