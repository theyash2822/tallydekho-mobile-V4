export type HomeMetricCard = {
  id: string;
  label: string;
  icon: string;
  amount: string;
  trend_pct?: number | null;
  trend_positive?: boolean | null;
};

type Spec = {
  id: string;
  label: string;
  icon: string;
  /** API field for the numeric value (defaults to id) */
  valueKey?: string;
  /** Prefix for trend_pct / trend_positive (defaults to valueKey or id) */
  trendKey?: string;
  /** When true, format value as plain string (e.g. transaction count) */
  rawAmount?: boolean;
};

export function buildHomeMetricCards(
  data: Record<string, unknown> | null | undefined,
  specs: Spec[],
  formatAmount: (n: number) => string,
): HomeMetricCard[] {
  const m = data || {};
  return specs.map(({ id, label, icon, valueKey, trendKey, rawAmount }) => {
    const vk = valueKey || id;
    const tk = trendKey || vk;
    const raw = Number(m[vk]) || 0;
    return {
      id,
      label,
      icon,
      amount: rawAmount ? String(Math.round(raw)) : formatAmount(Math.round(raw)),
      trend_pct: m[`${tk}_trend_pct`] as number | null | undefined,
      trend_positive: m[`${tk}_trend_positive`] as boolean | null | undefined,
    };
  });
}
