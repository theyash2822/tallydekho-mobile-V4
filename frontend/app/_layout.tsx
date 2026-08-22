import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { ONBOARDING_COMPLETED_KEY } from '../src/utils/onboardingNav';
import { COLORS } from '../src/constants/colors';
// Initialize i18n before anything renders
import '../src/i18n';

// Prevent splash screen from auto-hiding while fonts load
SplashScreen.preventAutoHideAsync();

function StatusBarCover() {
  const insets = useSafeAreaInsets();
  if (!insets.top) return null;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: insets.top,
        backgroundColor: COLORS.cardBg,
        zIndex: 1000,
      }}
    />
  );
}

function RootNavigation() {
  const { isAuthenticated, isLoading, company, setCompany, setIsPaired, setUser } = useAuth();
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
    if ((segments as string[]).length === 0) return;

    const inAuth = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';

    if (inOnboarding) return;

    (async () => {
      const onboardingDone = (await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY)) === 'true';

      if (!onboardingDone) {
        router.replace('/onboarding');
        return;
      }

      if (!isAuthenticated && !inAuth) {
        router.replace('/(auth)');
      } else if (isAuthenticated && inAuth) {
        router.replace('/(tabs)');
      }
    })();
  }, [isAuthenticated, isLoading, segments]);

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    ...Ionicons.font,
    ...FontAwesome5.font,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

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
              <StatusBarCover />
            </AuthProvider>
          </SettingsProvider>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
      <Toast config={toastConfig} topOffset={56} />
    </GestureHandlerRootView>
  );
}
