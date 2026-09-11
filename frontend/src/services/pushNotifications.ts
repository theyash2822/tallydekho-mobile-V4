// Push Notification Service — Expo
// Registers device for push notifications and saves token to backend
// Note: expo-notifications requires a dev build or production app — not supported in Expo Go SDK 53+
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { registerPushToken } from './api';
import { safePush } from '../utils/safeNavigation';

// SDK 53+: executionEnvironment is 'storeClient' in Expo Go, 'standalone'/'bare' in dev/prod builds
// appOwnership is deprecated since SDK 46 — do NOT use it
const isExpoGo = Constants.executionEnvironment === 'storeClient';

// Lazily import expo-notifications ONLY in dev/prod builds
// This avoids the "removed from Expo Go" error that fires at import time
let Notifications: typeof import('expo-notifications') | null = null;
if (!isExpoGo) {
  Notifications = require('expo-notifications');
  Notifications!.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Register device for push notifications and save token to backend.
 * Call this after user logs in.
 * Returns the Expo push token string, or null if permission denied / not a device.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Not supported in Expo Go SDK 53+
  if (isExpoGo || !Notifications) {
    console.log('[Push] Expo Go detected — push notifications require a dev build. Skipping.');
    return null;
  }

  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.log('[Push] Simulator detected — skipping push token registration');
    return null;
  }

  // Request permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[Push] Permission not granted');
    return null;
  }

  // Android requires a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'TallyDekho Notifications',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1A1A1A',
    });
  }

  try {
    const projectId =
      process.env.EXPO_PUBLIC_PROJECT_ID ||
      Constants.expoConfig?.extra?.eas?.projectId ||
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.warn('[Push] No projectId found — set EXPO_PUBLIC_PROJECT_ID in .env');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;
    if (__DEV__) console.log('[Push] Expo push token registered');

    // Save to backend
    await registerPushToken(token, Platform.OS);
    return token;
  } catch (err: any) {
    console.error('[Push] Token registration failed:', err.message);
    return null;
  }
}

/**
 * Set up notification response handler (tap on notification → navigate)
 */
export function setupNotificationHandlers(router: any) {
  // Not supported in Expo Go
  if (isExpoGo || !Notifications) return () => {};

  // Foreground notification received
  const foregroundSub = Notifications.addNotificationReceivedListener(notification => {
    console.log('[Push] Foreground notification:', notification.request.content);
  });

  // User tapped on notification
  const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data as any;
    if (!data?.type) return;

    // Navigate based on notification type
    switch (data.type) {
      case 'payment_reminder':
        if (data.companyGuid) {
          safePush(router, '/ledger');
        }
        break;
      case 'low_stock':
        safePush(router, '/stocks');
        break;
      case 'compliance':
        safePush(router, '/reports/compliance');
        break;
      default:
        safePush(router, '/');
    }
  });

  return () => {
    foregroundSub.remove();
    responseSub.remove();
  };
}
