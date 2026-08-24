/** Dashboard period filters → ISO date range (inclusive, ending today). */
export type DashboardPeriod = '7D' | '1M' | '3M' | '6M';

const PERIOD_DAYS: Record<DashboardPeriod, number> = {
  '7D': 7,
  '1M': 30,
  '3M': 90,
  '6M': 180,
};

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type FyBounds = { from?: string; to?: string };

/**
 * Compute from/to for dashboard API calls from the selected period pill.
 * When FY bounds are provided, the window is clamped inside that FY.
 * For a past FY (period would fall after FY end), uses the last N days of that FY.
 */
export function resolvePeriodDates(
  period: DashboardPeriod,
  fyBounds?: FyBounds | null,
): { from: string; to: string } {
  const days = PERIOD_DAYS[period] ?? 7;
  const fyFrom = fyBounds?.from?.slice(0, 10) || null;
  const fyTo = fyBounds?.to?.slice(0, 10) || null;

  const today = new Date();
  let to = toISO(today);
  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - (days - 1));
  let from = toISO(fromDate);

  if (fyFrom && fyTo) {
    // Period entirely after FY → anchor to end of FY
    if (from > fyTo) {
      const end = new Date(`${fyTo}T12:00:00`);
      const start = new Date(end);
      start.setDate(start.getDate() - (days - 1));
      from = toISO(start);
      to = fyTo;
    }
    if (to > fyTo) to = fyTo;
    if (from < fyFrom) from = fyFrom;
    if (to < fyFrom) to = fyFrom;
    if (from > to) from = to;
  }

  return { from, to };
}

export const CASHFLOW_PERIOD_KEY = 'cashflow_period';

export const SYNC_PERIODS = ['7D', '1M', '3M', '6M'] as const;

export function isSyncPeriod(v: string | null): v is DashboardPeriod {
  return (SYNC_PERIODS as readonly string[]).includes(v ?? '');
}
