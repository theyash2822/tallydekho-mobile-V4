import AsyncStorage from '@react-native-async-storage/async-storage';
type AppRouter = { replace: any };

export const ONBOARDING_COMPLETED_KEY = 'onboarding_completed';

export async function isOnboardingCompleted(): Promise<boolean> {
  const value = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY);
  return value === 'true';
}

export async function markOnboardingCompleted(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
}

/** After successful auth — tour first time, home otherwise. */
export async function navigateAfterAuth(router: AppRouter): Promise<void> {
  const done = await isOnboardingCompleted();
  router.replace(done ? '/(tabs)' : '/onboarding');
}
