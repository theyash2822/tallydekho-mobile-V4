/**
 * Global navigation tap-lock — prevents accidental double-tap from stacking
 * screens via router.push.
 *
 * Use safePush(router, href) instead of router.push(href) on every navigation CTA.
 *
 * Arms the lock BEFORE push so two near-simultaneous taps cannot both pass the check.
 */

const COOLDOWN_MS = 800;

let lockedUntil = 0;

export function isNavLocked(): boolean {
  return Date.now() < lockedUntil;
}

export function armNavLock(ms: number = COOLDOWN_MS): void {
  lockedUntil = Date.now() + ms;
}

type RouterLike = { push: (href: any) => void };

/** Drop a second push within the cooldown window. Returns true if pushed. */
export function safePush(router: RouterLike, href: any): boolean {
  if (isNavLocked()) return false;
  armNavLock();
  router.push(href);
  return true;
}

/**
 * Wrap an onPress so a second tap within the cooldown is ignored.
 * Prefer safePush at navigation call sites; use this only when the handler
 * does not itself call safePush (otherwise the pre-arm would block navigation).
 */
export function guardPress(
  fn?: (() => void) | null,
  cooldownMs: number = COOLDOWN_MS,
): (() => void) | undefined {
  if (!fn) return undefined;
  return () => {
    if (isNavLocked()) return;
    armNavLock(cooldownMs);
    fn();
  };
}
