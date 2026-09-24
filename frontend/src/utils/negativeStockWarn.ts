/**
 * Soft-warn when outbound qty would drive stock negative and
 * allow_negative_stock_app is OFF. Never hard-blocks.
 */
import { Alert } from 'react-native';
import { getInventorySettings } from '../services/api';

export async function confirmIfNegativeStockRisk(opts: {
  companyGuid?: string | null;
  /** Lines that will reduce stock */
  lines: Array<{ name: string; qty: number; available?: number }>;
}): Promise<boolean> {
  const { companyGuid, lines } = opts;
  if (!companyGuid || !lines.length) return true;

  let allowNegative = true;
  try {
    const res = await getInventorySettings(companyGuid);
    allowNegative = res?.data?.settings?.allow_negative_stock_app === true;
  } catch {
    return true;
  }
  if (allowNegative) return true;

  const offenders = lines.filter((l) => {
    const avail = l.available;
    if (avail == null || Number.isNaN(avail)) return false;
    return l.qty > avail;
  });
  if (!offenders.length) return true;

  const sample = offenders
    .slice(0, 3)
    .map((l) => `• ${l.name}: need ${l.qty}, have ${l.available}`)
    .join('\n');
  const more = offenders.length > 3 ? `\n…and ${offenders.length - 3} more` : '';

  return new Promise((resolve) => {
    Alert.alert(
      'Stock may go negative',
      `These items don’t have enough quantity:\n${sample}${more}\n\nContinue anyway?`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Continue', onPress: () => resolve(true) },
      ],
    );
  });
}
