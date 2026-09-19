/** One in-flight promise per slot. Concurrent callers share the same run. */
export function beginSingleFlight<T>(
  holder: { current: Promise<T> | null },
  run: () => Promise<T>,
): Promise<T> {
  if (holder.current) return holder.current;
  const pending = run().finally(() => {
    if (holder.current === pending) holder.current = null;
  });
  holder.current = pending;
  return pending;
}
