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

/** Compute from/to for dashboard API calls from the selected period pill. */
export function resolvePeriodDates(period: DashboardPeriod): { from: string; to: string } {
  const today = new Date();
  const to = toISO(today);
  const days = PERIOD_DAYS[period] ?? 7;
  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - (days - 1));
  return { from: toISO(fromDate), to };
}

export const CASHFLOW_PERIOD_KEY = 'cashflow_period';

export const SYNC_PERIODS = ['7D', '1M', '3M', '6M'] as const;

export function isSyncPeriod(v: string | null): v is DashboardPeriod {
  return (SYNC_PERIODS as readonly string[]).includes(v ?? '');
}
