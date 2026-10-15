/**
 * Shared RBAS helpers for voucher/master create screens:
 * Entry Mode toggle state + scope-filtered pickers + CONNECTED write gate.
 */
import { useCallback, useEffect, useState } from 'react';
import Toast from 'react-native-toast-message';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useWorkspace, type EntryMode } from '../context/WorkspaceContext';
import {
  BACKDATED_ENTRY_MESSAGE,
  canOpenVoucherCreate,
} from '../utils/voucherCreateGuard';
import {
  defaultEntryTypeForMode,
  type EntryType,
} from '../components/forms/RegularOptionalToggle';
import { assertTallyConnectedForWrite } from '../utils/rbasGate';

export function useRbasCreate(voucherCreateKind?: string) {
  const router = useRouter();
  const { selectedFY } = useAuth();
  const { entryMode, filterScoped, hasCapability, tallyConnected } = useWorkspace();

  useEffect(() => {
    if (!voucherCreateKind || canOpenVoucherCreate(selectedFY, voucherCreateKind)) return;
    Toast.show({
      type: 'error',
      text1: BACKDATED_ENTRY_MESSAGE,
    });
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)' as any);
  }, [voucherCreateKind, selectedFY, router]);
  const [entryType, setEntryType] = useState<EntryType>(() => defaultEntryTypeForMode(entryMode));
  const [prevMode, setPrevMode] = useState(entryMode);
  if (prevMode !== entryMode) {
    setPrevMode(entryMode);
    setEntryType(defaultEntryTypeForMode(entryMode));
  }

  const scopeParties = useCallback(
    (list: any[]) => filterScoped(Array.isArray(list) ? list : [], 'ledgers'),
    [filterScoped]
  );
  const scopeGodowns = useCallback(
    (list: any[]) => filterScoped(Array.isArray(list) ? list : [], 'godowns'),
    [filterScoped]
  );
  const scopeCostCentres = useCallback(
    (list: any[]) => filterScoped(Array.isArray(list) ? list : [], 'costCentres'),
    [filterScoped]
  );
  const scopeCompanies = useCallback(
    (list: any[]) => filterScoped(Array.isArray(list) ? list : [], 'companies'),
    [filterScoped]
  );
  const scopeFys = useCallback(
    (list: any[]) => filterScoped(Array.isArray(list) ? list : [], 'fys'),
    [filterScoped]
  );

  /** Product 2A: require CONNECTED + optional create capability before submit. */
  const assertCanCreate = useCallback(
    (capabilityKey?: string) => {
      if (!assertTallyConnectedForWrite()) return false;
      if (capabilityKey && !hasCapability(capabilityKey)) {
        Toast.show({
          type: 'error',
          text1: 'Not allowed',
          text2: 'Your role cannot create this voucher',
        });
        return false;
      }
      return true;
    },
    [hasCapability]
  );

  return {
    entryMode: entryMode as EntryMode,
    entryType,
    setEntryType,
    filterScoped,
    scopeParties,
    scopeGodowns,
    scopeCostCentres,
    scopeCompanies,
    scopeFys,
    hasCapability,
    tallyConnected,
    assertCanCreate,
    canSharePdf: hasCapability('document.pdf.generate'),
  };
}
