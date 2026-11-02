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
  entryTypeAllowed,
  type EntryType,
} from '../components/forms/RegularOptionalToggle';
import { assertTallyConnectedForWrite } from '../utils/rbasGate';
import { usesEntryMode } from '../utils/entryScope';

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
  const [entryTypeRaw, setEntryTypeRaw] = useState<EntryType>(() => defaultEntryTypeForMode(entryMode));
  const [prevMode, setPrevMode] = useState(entryMode);
  if (prevMode !== entryMode) {
    setPrevMode(entryMode);
    setEntryTypeRaw(defaultEntryTypeForMode(entryMode));
  }
  // A restored draft or a screen cannot pick a kind the role's entry mode forbids (Regular only /
  // Optional only): the value is clamped here, so every form shows and submits the allowed kind.
  const entryType: EntryType = entryTypeAllowed(entryMode, entryTypeRaw) ? entryTypeRaw : defaultEntryTypeForMode(entryMode);
  const setEntryType = useCallback(
    (next: EntryType) => setEntryTypeRaw(entryTypeAllowed(entryMode, next) ? next : defaultEntryTypeForMode(entryMode)),
    [entryMode]
  );

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

  /**
   * Product 2A: require CONNECTED + the create capability before submit, and — for every voucher
   * type — the kind (Regular / Optional) the entry mode allows. Converting a proforma is a regular
   * entry. `kind` overrides the hook's own toggle (e.g. a proforma screen that is always optional).
   */
  const assertCanCreate = useCallback(
    (capabilityKey?: string, kind?: EntryType) => {
      if (!assertTallyConnectedForWrite()) return false;
      if (capabilityKey && !hasCapability(capabilityKey)) {
        Toast.show({
          type: 'error',
          text1: 'Not allowed',
          text2: 'Your role cannot create this voucher',
        });
        return false;
      }
      if (capabilityKey && usesEntryMode(capabilityKey)) {
        const wanted: EntryType = capabilityKey === 'sales_proforma.convert_to_regular' ? 'regular' : (kind || entryType);
        if (!entryTypeAllowed(entryMode, wanted)) {
          Toast.show({
            type: 'error',
            text1: 'Not allowed',
            text2: entryMode === 'NONE'
              ? 'You cannot make entries in this company'
              : entryMode === 'OPTIONAL_ONLY'
                ? 'Your role allows optional entries only'
                : 'Your role allows regular entries only',
          });
          return false;
        }
      }
      return true;
    },
    [hasCapability, entryMode, entryType]
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
