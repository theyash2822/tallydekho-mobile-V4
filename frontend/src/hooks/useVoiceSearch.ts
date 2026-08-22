import { useCallback, useRef, useState } from 'react';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

export function useVoiceSearch() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const finalTextRef = useRef('');

  useSpeechRecognitionEvent('start', () => {
    setIsListening(true);
    setError(null);
  });

  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
  });

  useSpeechRecognitionEvent('result', (event) => {
    const text = (event.results[0]?.transcript || '').trim();
    if (!text) return;
    setTranscript(text);
    if (event.isFinal) finalTextRef.current = text;
  });

  useSpeechRecognitionEvent('error', (event) => {
    setIsListening(false);
    if (event.error === 'aborted') return;
    setError(event.message || 'Could not recognize speech. Try again.');
  });

  const start = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    setTranscript('');
    setError(null);
    finalTextRef.current = '';

    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      const msg = 'Voice search needs a development build (not available in Expo Go).';
      setError(msg);
      return { ok: false, error: msg };
    }

    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      const msg = 'Microphone permission is required for voice search.';
      setError(msg);
      return { ok: false, error: msg };
    }

    ExpoSpeechRecognitionModule.start({
      lang: 'en-IN',
      interimResults: true,
      continuous: false,
      maxAlternatives: 1,
    });
    return { ok: true };
  }, []);

  const stop = useCallback(() => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      /* already stopped */
    }
  }, []);

  const abort = useCallback(() => {
    try {
      ExpoSpeechRecognitionModule.abort();
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
