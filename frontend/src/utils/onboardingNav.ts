import AsyncStorage from '@react-native-async-storage/async-storage';
import { readUserInfo } from './userInfoStore';
type AppRouter = { replace: any };

const HOME_ROUTE = '/(tabs)';
const GUIDE_ROUTE = '/onboarding';

/**
 * App Guide v2, shown once per user after sign-in. Deliberately not a tenant key
 * (see tenantStorage sweep patterns), so signing out keeps it.
 */
export const guideSeenKey = (userId: string | number) => `auditer_guide_v2_seen:${userId}`;

/** signIn and registration both write user_info before navigating. */
async function resolveUserId(userId?: string | number | null): Promise<string | null> {
  if (userId != null && String(userId) !== '') return String(userId);
  try {
    const id = (await readUserInfo())?.id;
    return id != null && String(id) !== '' ? String(id) : null;
  } catch {
    return null;
  }
}

export async function hasSeenGuide(userId?: string | number | null): Promise<boolean> {
  const id = await resolveUserId(userId);
  if (!id) return false;
  return (await AsyncStorage.getItem(guideSeenKey(id))) === '1';
}

export async function markGuideSeen(userId?: string | number | null): Promise<void> {
  const id = await resolveUserId(userId);
  if (id) await AsyncStorage.setItem(guideSeenKey(id), '1');
}

/** Where the guide continues to: an in-app path, otherwise Home. */
export function guideDestination(next?: string | string[] | null): string {
  const value = Array.isArray(next) ? next[0] : next;
  return value && value.startsWith('/') && !value.startsWith('//') ? value : HOME_ROUTE;
}

/** The root layout and the sign-in screens both navigate right after signIn. */
const POST_AUTH_DEDUPE_MS = 2000;
let lastPostAuth: { at: number; done: Promise<void> } | null = null;

/** After sign-in: the App Guide if this user has not seen v2, then Home. */
export function navigateAfterAuth(router: AppRouter, opts: { userId?: string | number | null } = {}): Promise<void> {
  const now = Date.now();
  if (lastPostAuth && now - lastPostAuth.at < POST_AUTH_DEDUPE_MS) return lastPostAuth.done;
  const done = (async () => {
    const seen = await hasSeenGuide(opts.userId).catch(() => true);
    router.replace(seen ? HOME_ROUTE : { pathname: GUIDE_ROUTE, params: { next: HOME_ROUTE } });
  })();
  lastPostAuth = { at: now, done };
  // A failed navigation must not be handed to the next caller.
  done.catch(() => { if (lastPostAuth?.done === done) lastPostAuth = null; });
  return done;
}
