declare module 'expo-modules-core' {
  export function requireOptionalNativeModule<T = unknown>(name: string): T | null;
}
