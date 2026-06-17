import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { SettingsProvider } from '../src/context/SettingsContext';
import { getMe } from '../src/services/api';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import * as SplashScreen from 'expo-splash-screen';
import Toast from 'react-native-toast-message';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { toastConfig } from '../src/utils/toastConfig';
import { registerForPushNotifications, setupNotificationHandlers } from '../src/services/pushNotifications';
// Initialize i18n before anything renders
import '../src/i18n';

// Prevent splash screen from auto-hiding while fonts load
SplashScreen.preventAutoHideAsync();

function RootNavigation() {
  const { isAuthenticated, isLoading, company, setCompany, setIsPaired, setUser, user, signIn } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  // Register push notifications when user logs in
  useEffect(() => {
    if (!isAuthenticated) return;
    registerForPushNotifications().catch(() => {});
    return setupNotificationHandlers(router);
  }, [isAuthenticated]);

  // Bootstrap: if authenticated but no company, fetch /api/auth/me to restore state
  useEffect(() => {
    if (!isAuthenticated || company?.guid) return;
    getMe().then((res: any) => {
      const d = res?.data ?? res;
      if (d?.company?.guid) setCompany({ guid: d.company.guid, name: d.company.name, gstin: d.company.gstin });
      if (typeof d?.is_paired === 'boolean') setIsPaired(d.is_paired);
      if (d?.name || d?.phone) setUser({ id: d.id, name: d.name, phone: d.phone, email: d.email, language: d.language });
    }).catch(() => {});
  }, [isAuthenticated, company?.guid]);

  useEffect(() => {
    if (isLoading) return;
    // Wait for router to fully resolve before acting
    if ((segments as string[]).length === 0) return;

    const inAuth = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuth) {
      // Not logged in — send to auth screen
      router.replace('/(auth)');
    } else if (isAuthenticated && inAuth) {
      // Logged in but on auth screen — send to app
      router.replace('/(tabs)');
    }
    // Every other case: let Expo Router handle navigation naturally (no redirect)
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
        <BottomSheetModalProvider>
          <SettingsProvider>
            <AuthProvider>
              <StatusBar style="dark" />
              <RootNavigation />
            </AuthProvider>
          </SettingsProvider>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
      {/* Toast must be LAST so it renders above everything */}
      <Toast config={toastConfig} topOffset={56} />
    </GestureHandlerRootView>
  );
}
