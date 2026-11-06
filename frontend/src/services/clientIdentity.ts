/**
 * How this install introduces itself to the server. Every request says it is the app and names the device
 * (Settings → Signed-in devices lists the sign-ins by that name), and push tokens carry an id that stays with
 * this install across sign-ins, so the server keeps one token per device.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/** The server keeps at most this many characters of X-Device-Name. */
const DEVICE_NAME_MAX = 80;
const DEVICE_ID_KEY = 'td_device_id';
const OS_NAMES: Record<string, string> = { ios: 'iOS', android: 'Android', web: 'Web' };

/** "Pixel 7 (Android 15)", "iPhone 15 (iOS 18.1)"; only the system when the model is not known. */
export function deviceName(): string {
  const maker = String(Device.manufacturer || Device.brand || '').trim();
  let model = String(Device.modelName || '').trim();
  // Android model names are often codes ("SM-S918B"): the maker goes in front unless the name has it.
  if (Platform.OS === 'android' && maker && model && !model.toLowerCase().includes(maker.toLowerCase())) {
    model = `${maker.charAt(0).toUpperCase()}${maker.slice(1)} ${model}`;
  }
  // Android's Platform.Version is the API level (34), not the release the user knows (14).
  const version = Device.osVersion || (Platform.OS === 'ios' ? String(Platform.Version) : '');
  const system = [Device.osName || OS_NAMES[Platform.OS] || Platform.OS, version]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' ');
  const name = model ? `${model} (${system})` : system;
  return name.replace(/\s+/g, ' ').trim().slice(0, DEVICE_NAME_MAX).trim();
}

const NAME = deviceName();

/** Header values are Latin-1, so the name travels percent-encoded; the server decodes it. */
export const CLIENT_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'X-Client-Type': 'app',
  ...(NAME ? { 'X-Device-Name': encodeURIComponent(NAME) } : {}),
});

let _deviceId: Promise<string | null> | null = null;

/** A random id made once for this install and kept in the keychain (AsyncStorage on web); null when it cannot be kept. */
export function getDeviceId(): Promise<string | null> {
  if (!_deviceId) {
    _deviceId = loadDeviceId().then((id) => {
      if (!id) _deviceId = null;
      return id;
    });
  }
  return _deviceId;
}

async function loadDeviceId(): Promise<string | null> {
  try {
    const saved = Platform.OS === 'web'
      ? await AsyncStorage.getItem(DEVICE_ID_KEY)
      : await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (saved) return saved;
    const id = newDeviceId();
    if (Platform.OS === 'web') await AsyncStorage.setItem(DEVICE_ID_KEY, id);
    else await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return null;
  }
}

type RandomSource = { randomUUID?: () => string; getRandomValues?: (bytes: Uint8Array) => Uint8Array };

function newDeviceId(): string {
  const source = (globalThis as { crypto?: RandomSource }).crypto;
  if (typeof source?.randomUUID === 'function') return source.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof source?.getRandomValues === 'function') source.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // UUID version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
