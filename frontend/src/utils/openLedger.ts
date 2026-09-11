/**
 * Resolve a ledger GUID by exact name (or group parent) then navigate to detail.
 *
 * Prefer name lookup over vouchers.party_guid — Tally sync can stamp the same
 * wrong party_guid on many different party_name rows.
 */
import { Alert } from 'react-native';
import { getLedgers } from '../services/api';
import { safePush } from './safeNavigation';

type RouterLike = { push: (href: any) => void };

let openInFlight = false;

export async function openLedgerDetail(
  router: RouterLike,
  companyGuid: string | undefined,
  opts: { guid?: string | null; name?: string | null; group?: string | null },
) {
  if (openInFlight) return;
  if (!companyGuid) {
    Alert.alert('Ledger', 'Company not loaded yet. Try again.');
    return;
  }

  openInFlight = true;
  try {
    let guid = '';

    // 1) Exact name match (most reliable for party tiles)
    if (opts.name) {
      try {
        const res: any = await getLedgers(companyGuid, {
          search: opts.name,
          limit: '50',
          page: '1',
        });
        const rows: any[] = res?.data ?? [];
        const want = opts.name.trim().toLowerCase();
        const exact = rows.find(r => String(r.name || '').trim().toLowerCase() === want);
        guid = String(exact?.guid || exact?.id || '').trim();
      } catch { /* fall through */ }
    }

    // 2) Optional explicit guid (only if name didn't resolve)
    if (!guid && opts.guid) {
      guid = String(opts.guid).trim();
    }

    // 3) Group parent — open strongest ledger under that group (expense categories)
    if (!guid && opts.group) {
      try {
        const res: any = await getLedgers(companyGuid, {
          group: opts.group,
          limit: '20',
          page: '1',
        });
        const rows: any[] = res?.data ?? [];
        const sorted = [...rows].sort(
          (a, b) => Math.abs(+b.closing_balance || 0) - Math.abs(+a.closing_balance || 0),
        );
        guid = String(sorted[0]?.guid || sorted[0]?.id || '').trim();
      } catch { /* fall through */ }
    }

    if (!guid) {
      Alert.alert('Ledger not found', 'Could not open this ledger. Sync Tally and try again.');
      return;
    }

    safePush(router, `/ledger/${guid}` as any);
  } finally {
    openInFlight = false;
  }
}
