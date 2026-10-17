/**
 * A write whose Tally outcome is unknown (the desktop never acknowledged it) may
 * already be in Tally. It is only re-sent after the user confirms.
 * Free of React Native imports so scripts/verify-mobile-remediation.mjs can run it.
 */

export function isOutcomeUnknownError(err: any): boolean {
  return err?.code === 'OUTCOME_UNKNOWN' || err?.raw?.outcomeUnknown === true || err?.outcomeUnknown === true;
}

export type RetryOutcome<T> = { status: 'retried'; result: T } | { status: 'cancelled' };

export async function retryWithOutcomeConfirm<T>(
  retry: (opts: { confirmOutcomeUnknown?: boolean }) => Promise<T>,
  confirm: () => Promise<boolean>,
): Promise<RetryOutcome<T>> {
  try {
    return { status: 'retried', result: await retry({}) };
  } catch (err) {
    if (!isOutcomeUnknownError(err)) throw err;
    if (!(await confirm())) return { status: 'cancelled' };
    return { status: 'retried', result: await retry({ confirmOutcomeUnknown: true }) };
  }
}
