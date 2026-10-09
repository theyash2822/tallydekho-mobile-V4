/**
 * A write whose Tally outcome is unknown (the desktop never acknowledged it) may
 * already be in Tally, so it is never re-sent. The user reviews it instead: either
 * it was found in Tally, or the attempt is discarded.
 * Free of React Native imports so scripts/verify-mobile-remediation.mjs can run it.
 */

export function isOutcomeUnknownError(err: any): boolean {
  return err?.code === 'OUTCOME_UNKNOWN' || err?.raw?.outcomeUnknown === true || err?.outcomeUnknown === true;
}

export type UnknownResolution = 'found_in_tally' | 'discard';

export type RetryOutcome<T> =
  | { status: 'retried'; result: T }
  | { status: 'found_in_tally' }
  | { status: 'discarded' }
  | { status: 'cancelled' };

export async function retryOrReviewUnknown<T>(
  retry: () => Promise<T>,
  review: () => Promise<UnknownResolution | null>,
  resolve: (resolution: UnknownResolution) => Promise<unknown>,
): Promise<RetryOutcome<T>> {
  try {
    return { status: 'retried', result: await retry() };
  } catch (err) {
    if (!isOutcomeUnknownError(err)) throw err;
    const choice = await review();
    if (!choice) return { status: 'cancelled' };
    await resolve(choice);
    return { status: choice === 'discard' ? 'discarded' : 'found_in_tally' };
  }
}
