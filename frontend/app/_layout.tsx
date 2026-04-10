import { useEffect, useState } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

type AuthState = 'loading' | 'authenticated' | 'unauthenticated';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [authState, setAuthState] = useState<AuthState>('loading');

  useEffect(() => {
    AsyncStorage.getItem('auth_token').then(token => {
      setAuthState(token ? 'authenticated' : 'unauthenticated');
    });
  }, []);

  useEffect(() => {
    if (authState === 'loading') return;
    const inAuth = segments[0] === '(auth)';
    if (authState === 'unauthenticated' && !inAuth) {
      router.replace('/(auth)');
    } else if (authState === 'authenticated' && inAuth) {
      router.replace('/(tabs)');
    }
  }, [authState, segments]);

  return (
    <>
      <StatusBar style="dark" />
      <Slot />
    </>
  );
}
