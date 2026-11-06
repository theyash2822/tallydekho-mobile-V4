/**
 * The way to the sign-in screen after a sign-out. Every stack on the path to the screen on top is emptied first,
 * so Android Back or the iOS swipe on the sign-in screen cannot reopen a signed-in screen.
 */

type NavState = {
  type?: string;
  index?: number;
  routes?: { name?: string; state?: NavState }[];
  history?: unknown[];
} | undefined;

type RouterLike = { dismissAll: () => void; replace: (href: '/(auth)') => void };
type RootStateSource = { getRootState: () => unknown };

/** Two calls this close together (the layout reacting to the sign-out, the screen that started it) are one. */
const SETTLE_MS = 1_000;
let lastLeftAt = 0;

/**
 * Stacks on the focused path holding more than one screen. dismissAll() pops the deepest one; a stack already
 * on its first screen passes it up to its parent, so each counted stack takes one call.
 */
export function stacksToEmpty(state: NavState): number {
  let count = 0;
  let node = state;
  while (node) {
    if (node.type === 'stack') {
      const depth = Array.isArray(node.history) ? node.history.length : (node.index ?? 0) + 1;
      if (depth > 1) count += 1;
    }
    if (node.index == null) break;
    node = node.routes?.[node.index]?.state;
  }
  return count;
}

/** Router actions queued in one go are applied together, so no emptied-out screen shows on the way. */
export function leaveForSignIn(router: RouterLike, navigation: RootStateSource): void {
  const now = Date.now();
  if (now - lastLeftAt < SETTLE_MS) return;
  let root: NavState;
  try {
    root = navigation.getRootState() as NavState;
  } catch {
    root = undefined;
  }
  const pops = stacksToEmpty(root);
  if (!pops && root?.routes?.[root.index ?? 0]?.name === '(auth)') return;
  lastLeftAt = now;
  for (let i = 0; i < pops; i += 1) router.dismissAll();
  router.replace('/(auth)');
}
