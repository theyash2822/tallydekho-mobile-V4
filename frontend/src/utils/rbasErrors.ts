/**
 * §31 RBAS error codes — toast without global logout (403 already excluded in api.ts).
 */
import Toast from 'react-native-toast-message';
import { ApiError, isApiError } from '../services/apiErrors';

export const RBAS_ERROR_CODES = new Set([
  'WORKSPACE_ACCESS_DENIED',
  'WORKSPACE_SUSPENDED',
  'WORKSPACE_CLOSED',
  'MEMBERSHIP_SUSPENDED',
  'CAPABILITY_DENIED',
  'COMPANY_SCOPE_DENIED',
  'FY_SCOPE_DENIED',
  'LEDGER_SCOPE_DENIED',
  'GODOWN_SCOPE_DENIED',
  'COST_CENTRE_SCOPE_DENIED',
  'TALLY_NOT_CONNECTED',
  'DEVICE_ALREADY_PAIRED',
  'WORKSPACE_ALREADY_HAS_DESKTOP',
  'HARD_SYNC_ALREADY_APPROVED',
  'INTEGRATION_NOT_CONFIGURED',
  'BILLING_INSUFFICIENT_CREDITS',
  'INSUFFICIENT_CREDITS',
  'MIXED_FUNDING_PRIORITY_UNDEFINED',
  'SPLIT_FUNDING_RULE_UNDEFINED',
]);

const TITLES: Record<string, string> = {
  WORKSPACE_ACCESS_DENIED: 'Workspace access denied',
  WORKSPACE_SUSPENDED: 'Workspace unavailable',
  WORKSPACE_CLOSED: 'Workspace closed',
  MEMBERSHIP_SUSPENDED: 'Access suspended',
  CAPABILITY_DENIED: 'Not allowed',
  COMPANY_SCOPE_DENIED: 'Company not in scope',
  FY_SCOPE_DENIED: 'Financial year not in scope',
  LEDGER_SCOPE_DENIED: 'Ledger not in scope',
  GODOWN_SCOPE_DENIED: 'Godown not in scope',
  COST_CENTRE_SCOPE_DENIED: 'Cost centre not in scope',
  TALLY_NOT_CONNECTED: 'Tally not connected',
  DEVICE_ALREADY_PAIRED: 'Desktop already paired elsewhere',
  WORKSPACE_ALREADY_HAS_DESKTOP: 'Workspace already has a Desktop',
  HARD_SYNC_ALREADY_APPROVED: 'Already approved',
  INTEGRATION_NOT_CONFIGURED: 'Integration not ready',
  BILLING_INSUFFICIENT_CREDITS: 'Insufficient credits',
  INSUFFICIENT_CREDITS: 'Insufficient credits',
  MIXED_FUNDING_PRIORITY_UNDEFINED: 'Billing policy pending',
  SPLIT_FUNDING_RULE_UNDEFINED: 'Billing policy pending',
};

export function isRbasError(err: unknown): boolean {
  if (!isApiError(err) && !(err instanceof ApiError)) return false;
  const code = (err as ApiError).code;
  return !!(code && RBAS_ERROR_CODES.has(code));
}

/** Show a dedicated toast for known RBAS codes. Returns true if handled. */
export function toastRbasError(err: unknown, fallbackMessage?: string): boolean {
  if (!isApiError(err) && !(err instanceof ApiError)) {
    if (fallbackMessage) {
      Toast.show({ type: 'error', text1: 'Error', text2: fallbackMessage });
    }
    return false;
  }
  const e = err as ApiError;
  const code = e.code || '';
  if (!RBAS_ERROR_CODES.has(code)) return false;
  Toast.show({
    type: 'error',
    text1: TITLES[code] || 'Access error',
    text2: e.message || fallbackMessage || code,
  });
  return true;
}
