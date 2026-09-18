/**
 * Non-React RBAS gates for shared utils (PDF share, etc.).
 * WorkspaceProvider registers the live hasCapability checker.
 * Fail-closed until the provider mounts (product Wave 1).
 */
import Toast from 'react-native-toast-message';

type CapFn = (key: string) => boolean;

let _hasCapability: CapFn = () => false;

export function setRbasCapabilityChecker(fn: CapFn | null) {
  _hasCapability = fn || (() => false);
}

export function rbasHasCapability(key: string): boolean {
  try {
    return !!_hasCapability(key);
  } catch {
    return false;
  }
}

/** Returns false (and toasts) when PDF share is not allowed. */
export function assertCanSharePdf(): boolean {
  if (rbasHasCapability('document.pdf.generate')) return true;
  Toast.show({
    type: 'error',
    text1: 'Not allowed',
    text2: 'PDF share is not permitted for your role',
  });
  return false;
}

/** Live Tally writes require CONNECTED workspace (product 2A). */
let _tallyConnected: () => boolean = () => false;

export function setTallyConnectedChecker(fn: (() => boolean) | null) {
  _tallyConnected = fn || (() => false);
}

export function isTallyConnected(): boolean {
  try {
    return !!_tallyConnected();
  } catch {
    return false;
  }
}

export function assertTallyConnectedForWrite(): boolean {
  if (isTallyConnected()) return true;
  Toast.show({
    type: 'error',
    text1: 'Tally not connected',
    text2: 'Connect and sync Desktop before creating vouchers',
  });
  return false;
}
