// Push Notification Service — Expo
// Registers device for push notifications and saves token to backend
// Note: expo-notifications requires a dev build or production app — not supported in Expo Go SDK 53+
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getActiveWorkspaceId, registerPushToken } from './api';
import { getDeviceId } from './clientIdentity';
import { safePush } from '../utils/safeNavigation';
import { complianceLinkRoute, isAllowedPushRoute, isComplianceAlert, notificationRoute } from '../utils/notificationLinks';
import { pushProjectIdStartupWarning, resolvePushProjectId } from './pushProjectId';

/** The sources `resolvePushProjectId` reads in this runtime. */
function projectIdSources() {
  return {
    env: process.env as Record<string, string | undefined>,
    extra: Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined,
    easConfig: Constants.easConfig as { projectId?: string } | null | undefined,
  };
}

/**
 * Dev-only startup check (SEC-049): a build without an EAS project id never
 * registers for push and would fail silently in release. Logged once.
 */
export function warnIfPushProjectIdMissing(): void {
  if (!__DEV__ || Platform.OS === 'web') return;
  const msg = pushProjectIdStartupWarning(projectIdSources());
  if (msg) console.warn(msg);
}

// SDK 53+: executionEnvironment is 'storeClient' in Expo Go, 'standalone'/'bare' in dev/prod builds
// appOwnership is deprecated since SDK 46 — do NOT use it
const isExpoGo = Constants.executionEnvironment === 'storeClient';
/** Kept across launches so a sign-out right after a cold start can still name this device's token. */
const PUSH_TOKEN_KEY = 'td_push_token';
let _lastPushToken: string | null = null;
export function getLastPushToken(): string | null {
  return _lastPushToken;
}

/** This device's Expo push token as last registered (this launch or an earlier one); null when never. */
export async function getStoredPushToken(): Promise<string | null> {
  if (_lastPushToken) return _lastPushToken;
  try {
    return await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  } catch {
    return null;
  }
}

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
 * `askPermission: false` only re-sends when notifications are already allowed (no system prompt).
 */
export async function registerForPushNotifications({ askPermission = true }: { askPermission?: boolean } = {}): Promise<string | null> {
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
  const permissionStatus = (res: unknown) => {
    if (typeof res === 'string') return res;
    if (res && typeof res === 'object' && 'status' in res) {
      return String((res as { status?: string }).status || '');
    }
    return '';
  };
  const existingStatus = permissionStatus(await Notifications.getPermissionsAsync());
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted' && askPermission) {
    finalStatus = permissionStatus(await Notifications.requestPermissionsAsync());
  }

  if (finalStatus !== 'granted') {
    console.log('[Push] Permission not granted');
    return null;
  }

  // Android requires a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Auditer Notifications',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1A1A1A',
    });
  }

  try {
    const projectId = resolvePushProjectId(projectIdSources());

    if (!projectId) {
      console.warn(pushProjectIdStartupWarning(projectIdSources()));
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;
    _lastPushToken = token;
    AsyncStorage.setItem(PUSH_TOKEN_KEY, token).catch(() => {});
    if (__DEV__) console.log('[Push] Expo push token registered');

    // The server ties the token to this sign-in session and takes it away from any other account.
    const deviceId = await getDeviceId();
    await registerPushToken(token, Platform.OS, deviceId || undefined);
    return token;
  } catch (err: any) {
    console.error('[Push] Token registration failed:', err.message);
    return null;
  }
}

/**
 * Registers this device's token again for the current session. Ending other sessions (a PIN or phone change,
 * Log out of all devices with this one kept) deletes every token the server cannot tie to this session.
 */
export function refreshPushRegistration(): Promise<string | null> {
  return registerForPushNotifications({ askPermission: false }).catch(() => null);
}

/**
 * Set up notification response handler (tap on notification → navigate)
 */
export function setupNotificationHandlers(router: any) {
  // Not supported in Expo Go
  if (isExpoGo || !Notifications) return () => {};

  // Foreground notification received
  const foregroundSub = Notifications.addNotificationReceivedListener(() => {
    if (__DEV__) console.log('[Push] Foreground notification received');
  });

  // User tapped on notification
  const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data as any;
    if (!data?.type) return;
    const eventWs = data.workspaceId || data.workspace_id;
    const active = getActiveWorkspaceId();
    if (eventWs && active && String(eventWs) !== String(active)) return;

    // Compliance alerts name the web page they are about (`data.link`); open the matching app screen.
    // Only known in-app route groups may be opened from a notification payload.
    const linked = isComplianceAlert(data)
      ? (complianceLinkRoute(data.link) || '/reports/compliance')
      : notificationRoute({ target: data.target, route: data.route });
    if (linked && isAllowedPushRoute(linked)) {
      safePush(router, linked);
      return;
    }

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
      case 'restore_request':
        safePush(router, '/settings/requests?tab=approvals');
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
