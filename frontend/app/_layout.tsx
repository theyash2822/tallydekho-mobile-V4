import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import * as SplashScreen from 'expo-splash-screen';
import Toast from 'react-native-toast-message';
import { toastConfig } from '../src/utils/toastConfig';

// Prevent splash screen from auto-hiding while fonts load
SplashScreen.preventAutoHideAsync();

// Module-level flag — lives in JS memory only.
// Resets to false on every Metro reload / cold app start automatically.
let _onboardingShownThisSession = false;

function RootNavigation() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;
    if (segments.length === 0) return;

    const inAuth       = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';

    // ── Always show onboarding first on every fresh app start ──
    if (!_onboardingShownThisSession && !inOnboarding) {
      _onboardingShownThisSession = true;
      router.replace('/onboarding');
      return;
    }

    // ── After onboarding: normal auth guard ──
    if (!inOnboarding && !isAuthenticated && !inAuth) {
      router.replace('/(auth)');
    }
  }, [isAuthenticated, isLoading, segments]);

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  // Load Ionicons + FontAwesome5 Brands (for WhatsApp icon) — without this, all icons show as □ rectangles on device
  const [fontsLoaded, fontError] = useFonts({
    ...Ionicons.font,
    ...FontAwesome5.font,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Block rendering until fonts are ready
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <RootNavigation />
        </AuthProvider>
      </SafeAreaProvider>
      {/* Toast must be LAST so it renders above everything */}
      <Toast config={toastConfig} topOffset={56} />
    </GestureHandlerRootView>
  );
}
