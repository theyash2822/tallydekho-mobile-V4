import React, { useEffect, useState } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';

// Prevent splash screen from auto-hiding while fonts load
SplashScreen.preventAutoHideAsync();

function RootNavigation() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const [guideChecked, setGuideChecked] = useState(false);
  const [guideSeen,    setGuideSeen]    = useState(false);

  // Load guide-seen flag once on mount
  useEffect(() => {
    AsyncStorage.getItem('hasSeenGuide_v2').then(val => {
      setGuideSeen(val === 'true');
      setGuideChecked(true);
    });
  }, []);

  useEffect(() => {
    if (isLoading || !guideChecked) return;
    if (segments.length === 0) return;

    const inAuth       = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';

    if (!isAuthenticated && !inAuth) {
      // Not logged in — send to auth screen
      router.replace('/(auth)');
    } else if (isAuthenticated && inAuth) {
      // Logged in — show guide first time, then app
      router.replace(guideSeen ? '/(tabs)' : '/onboarding');
    }
    // Every other case (already in tabs / onboarding): Expo Router handles naturally
  }, [isAuthenticated, isLoading, guideChecked, guideSeen, segments]);

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
