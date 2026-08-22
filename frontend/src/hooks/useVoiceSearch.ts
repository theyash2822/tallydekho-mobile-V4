import { useCallback, useEffect, useRef, useState } from 'react';

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

type SpeechPackage = {
  ExpoSpeechRecognitionModule: SpeechRecognitionModule;
};

const DEV_BUILD_MSG =
  'Voice search needs a development build (not Expo Go). Run: npx expo run:ios';

let cachedSpeechPackage: SpeechPackage | null | undefined;

/** Lazy-load so Expo Go without the native module does not crash on import. */
function loadSpeechPackage(): SpeechPackage | null {
  if (cachedSpeechPackage !== undefined) return cachedSpeechPackage;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedSpeechPackage = require('expo-speech-recognition') as SpeechPackage;
    return cachedSpeechPackage;
  } catch {
    cachedSpeechPackage = null;
    return null;
  }
}

export function useVoiceSearch() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const finalTextRef = useRef('');
  const subsRef = useRef<Array<{ remove: () => void }>>([]);

  useEffect(() => {
    const pkg = loadSpeechPackage();
    if (!pkg) return;

    const M = pkg.ExpoSpeechRecognitionModule;
    subsRef.current = [
      M.addListener('start', () => {
        setIsListening(true);
        setError(null);
      }),
      M.addListener('end', () => {
        setIsListening(false);
      }),
      M.addListener('result', (event) => {
        const text = (event.results[0]?.transcript || '').trim();
        if (!text) return;
        setTranscript(text);
        if (event.isFinal) finalTextRef.current = text;
      }),
      M.addListener('error', (event) => {
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

    const pkg = loadSpeechPackage();
    if (!pkg) {
      setError(DEV_BUILD_MSG);
      return { ok: false, error: DEV_BUILD_MSG };
    }

    const M = pkg.ExpoSpeechRecognitionModule;

    try {
      if (!M.isRecognitionAvailable()) {
        setError(DEV_BUILD_MSG);
        return { ok: false, error: DEV_BUILD_MSG };
      }
    } catch {
      setError(DEV_BUILD_MSG);
      return { ok: false, error: DEV_BUILD_MSG };
    }

    const perm = await M.requestPermissionsAsync();
    if (!perm.granted) {
      const msg = 'Microphone permission is required for voice search.';
      setError(msg);
      return { ok: false, error: msg };
    }

    M.start({
      lang: 'en-IN',
      interimResults: true,
      continuous: false,
      maxAlternatives: 1,
    });
    return { ok: true };
  }, []);

  const stop = useCallback(() => {
    try {
      loadSpeechPackage()?.ExpoSpeechRecognitionModule.stop();
    } catch {
      /* already stopped */
    }
  }, []);

  const abort = useCallback(() => {
    try {
      loadSpeechPackage()?.ExpoSpeechRecognitionModule.abort();
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
