import React, { useEffect, useState } from 'react';
import { View, LogBox } from 'react-native';
import { Stack, useNavigationContainerRef, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { SettingsProvider } from '../src/context/SettingsContext';
import { WorkspaceProvider } from '../src/context/WorkspaceContext';
import { getMe, getActiveWorkspaceId, getCompanies } from '../src/services/api';
import { onScopeRemoved, handleScopeRemoved, isWorkspaceDraftKey } from '../src/services/scopeRefresh';
import { isDemoCompany } from '../src/utils/isDemoCompany';
import { captureWorkspaceGeneration, isCurrentWorkspaceGeneration } from '../src/utils/workspaceGeneration';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import * as SplashScreen from 'expo-splash-screen';
import Toast from 'react-native-toast-message';
import { BottomSheetModalProvider, useBottomSheetModal } from '@gorhom/bottom-sheet';
import { toastConfig } from '../src/utils/toastConfig';
import { registerForPushNotifications, setupNotificationHandlers, warnIfPushProjectIdMissing } from '../src/services/pushNotifications';
import { navigateAfterAuth } from '../src/utils/onboardingNav';
import { leaveForSignIn } from '../src/utils/signOutNavigation';
import { COLORS } from '../src/constants/colors';
import ServerReachabilityBanner from '../src/components/ServerReachabilityBanner';
import { ErrorState } from '../src/components/ApiStateViews';
import { initMonitoring, reportError } from '../src/services/monitoring';
import { DEMO_MODE } from '../src/demo/config';
import { startDemo } from '../src/demo/demoData';
// Initialize i18n before anything renders
import '../src/i18n';

// Demo build: answer the backend from recorded data before any screen asks for it.
const demoStarted = startDemo();

// Dev-only noise: Expo CLI tunnel + transient socket reconnects must not block HR UX
if (__DEV__) {
  LogBox.ignoreLogs([
    'Cannot connect to Expo CLI',
    '[Socket] connect error',
    'websocket error',
  ]);
}

initMonitoring();
// Dev-only: a build without an EAS project id never registers for push (SEC-049).
warnIfPushProjectIdMissing();

// Prevent splash screen from auto-hiding while fonts load
SplashScreen.preventAutoHideAsync().catch(() => {});

/** Expo Router renders this instead of a crashed screen tree. */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  const { t } = useTranslation();
  useEffect(() => {
    reportError(error, { boundary: 'root' });
  }, [error]);
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.cardBg }}>
      <ErrorState
        title={t('common.somethingWentWrong')}
        message={t('screens.layout.unexpectedProblem')}
        onRetry={() => { retry().catch(() => {}); }}
      />
    </View>
  );
}

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
  const { isAuthenticated, isLoading, setUser } = useAuth();
  const router = useRouter();
  const navigationRef = useNavigationContainerRef();
  const segments = useSegments();

  const { dismissAll: dismissSheets } = useBottomSheetModal();
  useEffect(() => {
    if (!isAuthenticated) return;
    return onScopeRemoved((payload) => {
      handleScopeRemoved({
        held: payload?.held,
        closeForms: () => {
          dismissSheets();
          if (router.canDismiss()) router.dismissAll();
        },
        clearDrafts: async () => {
          const ws = payload?.workspaceId || getActiveWorkspaceId();
          const clear = async () => {
            const keys = await AsyncStorage.getAllKeys();
            const drafts = keys.filter((k) => isWorkspaceDraftKey(k, ws));
            if (drafts.length) await AsyncStorage.multiRemove(drafts);
          };
          await clear();
          // A debounced (800 ms) draft save already in flight must not bring the form back.
          setTimeout(() => { clear().catch(() => {}); }, 1000);
        },
        goHome: () => router.replace('/(tabs)'),
        loadCompanies: async () => {
          const res: any = await getCompanies();
          const list = Array.isArray(res?.data) ? res.data : [];
          return list.filter((c: any) => !isDemoCompany(c) && c?.is_active !== false);
        },
        toast: (message) => Toast.show({ type: 'info', text1: message }),
      });
    });
  }, [isAuthenticated, dismissSheets]);

  // Register push notifications when user logs in
  useEffect(() => {
    if (!isAuthenticated) return;
    registerForPushNotifications().catch(() => {});
    return setupNotificationHandlers(router);
  }, [isAuthenticated]);

  // Bootstrap user profile only. /auth/me company is not workspace-authoritative.
  useEffect(() => {
    if (!isAuthenticated) return;
    const snap = captureWorkspaceGeneration();
    getMe().then((res: any) => {
      if (!isCurrentWorkspaceGeneration(snap.gen, snap.workspaceId || getActiveWorkspaceId())) return;
      const d = res?.data ?? res;
      if (d?.name || d?.phone) setUser({ id: d.id, name: d.name, phone: d.phone, email: d.email, language: d.language });
    }).catch(() => {});
  }, [isAuthenticated, setUser]);

  useEffect(() => {
    if (isLoading) return;
    if ((segments as string[]).length === 0) return;

    const inAuth = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';

    if (inOnboarding) return;

    if (!isAuthenticated && !inAuth) {
      dismissSheets();
      leaveForSignIn(router, navigationRef);
    } else if (isAuthenticated && inAuth) {
      // Same decision as the sign-in screens (App Guide once per user, then Home), so a fresh
      // sign-in and a restored session never race to two different screens.
      navigateAfterAuth(router).catch(() => router.replace('/(tabs)'));
    }
  }, [isAuthenticated, isLoading, segments]);

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    ...Ionicons.font,
    ...FontAwesome5.font,
  });
  const [demoReady, setDemoReady] = useState(!DEMO_MODE);

  useEffect(() => {
    if (DEMO_MODE) demoStarted.finally(() => setDemoReady(true));
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if ((!fontsLoaded && !fontError) || !demoReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          <SettingsProvider>
            <AuthProvider>
              <WorkspaceProvider>
                <StatusBar style="dark" />
                <RootNavigation />
                <StatusBarCover />
                <ServerReachabilityBanner />
              </WorkspaceProvider>
            </AuthProvider>
          </SettingsProvider>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
      <Toast config={toastConfig} topOffset={56} />
    </GestureHandlerRootView>
  );
}
