// Push Notification Service — Expo
// Registers device for push notifications and saves token to backend
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { registerPushToken } from './api';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Register device for push notifications and save token to backend.
 * Call this after user logs in.
 * Returns the Expo push token string, or null if permission denied / not a device.
 */
export async function registerForPushNotifications(): Promise<string | null> {
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
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID, // set in app.json / .env
    });
    const token = tokenData.data;
    console.log('[Push] Expo push token:', token);

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
          router.push('/ledger');
        }
        break;
      case 'low_stock':
        router.push('/stocks');
        break;
      case 'compliance':
        router.push('/reports/compliance');
        break;
      default:
        router.push('/');
    }
  });

  return () => {
    foregroundSub.remove();
    responseSub.remove();
  };
}
