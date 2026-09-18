/**
 * Shared RBAS helpers for voucher/master create screens:
 * Entry Mode toggle state + scope-filtered pickers + CONNECTED write gate.
 */
import { useCallback, useRef, useState } from 'react';
import Toast from 'react-native-toast-message';
import { useWorkspace, type EntryMode } from '../context/WorkspaceContext';
import {
  defaultEntryTypeForMode,
  type EntryType,
} from '../components/forms/RegularOptionalToggle';
import { assertTallyConnectedForWrite } from '../utils/rbasGate';

export function useRbasCreate() {
  const { entryMode, filterScoped, hasCapability, tallyConnected } = useWorkspace();
  const [entryType, setEntryType] = useState<EntryType>(() => defaultEntryTypeForMode(entryMode));
  const prevModeRef = useRef(entryMode);
  if (prevModeRef.current !== entryMode) {
    prevModeRef.current = entryMode;
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
