export type FyLike = {
  label?: string;
  startDate?: string;
  endDate?: string;
  finYear?: string;
  begin_date?: string;
  end_date?: string;
  fin_year?: string;
};

export function normalizeFy(raw: FyLike | null | undefined): {
  label: string;
  startDate: string;
  endDate: string;
  finYear?: string;
} | null {
  if (!raw) return null;
  const startDate = String(raw.startDate || raw.begin_date || '').trim();
  const endDate = String(raw.endDate || raw.end_date || '').trim();
  const label = String(raw.label || '').trim();
  const finYear = raw.finYear || raw.fin_year || undefined;
  if (!startDate && !label) return null;
  return { label: label || startDate, startDate, endDate, finYear };
}

export function fyEquals(a: FyLike | null | undefined, b: FyLike | null | undefined): boolean {
  const na = normalizeFy(a);
  const nb = normalizeFy(b);
  if (!na && !nb) return true;
  if (!na || !nb) return false;
  if (na.startDate && nb.startDate) {
    return na.startDate === nb.startDate && (na.endDate || '') === (nb.endDate || '');
  }
  return na.label === nb.label;
}

export function fyInList(current: FyLike | null | undefined, list: FyLike[]): boolean {
  if (!current) return false;
  return (list || []).some((row) => fyEquals(current, row));
}
