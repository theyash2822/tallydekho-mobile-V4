import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Modal, FlatList, Pressable,
  Vibration, Alert, ActivityIndicator, Switch, RefreshControl,
  useWindowDimensions, Dimensions,
} from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { encodeCode128B } from '../../src/utils/barcode';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { safePush } from '../../src/utils/safeNavigation';
import { stocksBarcodeScan } from '../../src/utils/stocksBarcodeScan';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import SearchBar from '../../src/components/SearchBar';
import FilterBottomSheet, {
  FilterCheckRow,
  FilterRadioRow,
  filterSheetContentStyles as fm,
  isFilterAllSelected,
  isFilterOptionChecked,
  toggleFilterFromAll,
  toggleFilterAll,
  useMultiFilterHydration,
  isFilterSelectionValid,
  normalizeFilterAllSelection,
  isFilterNarrowing,
} from '../../src/components/FilterBottomSheet';
import { FilterIconWithBadge, ActiveFilterChips } from '../../src/components/voucherHomeFilters';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import i18n from '../../src/i18n';
import { useSettings } from '../../src/context/SettingsContext';
import { useAuth } from '../../src/context/AuthContext';
import {
  getBarcodeList, getBarcodeSettings, saveBarcodeSettings, pushPendingBarcodes, downloadBarcodeTemplate,
  generateBarcode, generateBulkBarcodes, linkBarcode, lookupBarcode,
  bulkImportBarcodes, BarcodeItem, BarcodeSettings,
  startBulkBarcodeJob, getBulkBarcodeJobStatus, getActiveBulkBarcodeJob,
  BulkBarcodeJobStatus,
} from '../../src/services/api';

const AMBER = '#A89060';
const SCREEN_H = Dimensions.get('window').height;

/** Bottom sheet shell for Import / Settings / item actions (RN Modal). */
function BarcodeActionSheet({
  visible,
  onClose,
  title,
  children,
  footer,
  headerContent,
  heightFraction = 0.88,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  headerContent?: React.ReactNode;
  heightFraction?: number;
}) {
  const insets = useSafeAreaInsets();
  const sheetH = Math.min(SCREEN_H * heightFraction, SCREEN_H * 0.92);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.modalRoot}>
        <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={onClose} />
        <View style={s.modalSheetContainer} pointerEvents="box-none">
          <View style={[s.actionSheet, { height: sheetH, paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={s.modalHandle} />
            <View style={s.importHeader}>
              <Text style={s.importTitle}>{title}</Text>
              <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            {headerContent ? (
              <View style={s.actionSheetHeader}>{headerContent}</View>
            ) : null}
            <ScrollView
              style={s.actionSheetBody}
              contentContainerStyle={s.actionSheetBodyContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              {children}
            </ScrollView>
            {footer ? <View style={s.actionSheetFooter}>{footer}</View> : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function BarcodeFilterModal({
  visible,
  onClose,
  onApply,
  initPeriod,
  initGroup,
  initStatus,
  groupOptions,
  statusOptions,
}: {
  visible: boolean;
  onClose: () => void;
  onApply: (period: string, groups: string[], statuses: string[]) => void;
  initPeriod: string;
  initGroup: string[];
  initStatus: string[];
  groupOptions: { id: string; label: string }[];
  statusOptions: { id: string; label: string }[];
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'Period' | 'Group' | 'Status'>('Period');
  const [selPeriod, setSelPeriod] = useState('All');
  const [selGroup, setSelGroup] = useState<string[]>([]);
  const [selStatus, setSelStatus] = useState<string[]>([]);
  const [grpSearch, setGrpSearch] = useState('');
  const [statusSearch, setStatusSearch] = useState('');

  const grpIds = useMemo(() => groupOptions.map(g => g.id), [groupOptions]);
  const statusIds = useMemo(() => statusOptions.map(st => st.id), [statusOptions]);

  const [prevSync, setPrevSync] = useState<unknown[] | null>(null);
  if (!prevSync || prevSync[0] !== visible || prevSync[1] !== initPeriod) {
    setPrevSync([visible, initPeriod]);
    if (visible) {
      setSelPeriod(initPeriod);
      setGrpSearch('');
      setStatusSearch('');
      setTab('Period');
    }
  }

  useMultiFilterHydration(visible, initGroup, grpIds, setSelGroup);
  useMultiFilterHydration(visible, initStatus, statusIds, setSelStatus);

  const isAllGrp = isFilterAllSelected(selGroup, grpIds);
  const isAllStatus = isFilterAllSelected(selStatus, statusIds);
  const activeCount =
    (selPeriod !== 'All' ? 1 : 0)
    + (isAllGrp ? 0 : selGroup.length)
    + (isAllStatus ? 0 : selStatus.length);
  const canApply =
    isFilterSelectionValid(selGroup, grpIds) && isFilterSelectionValid(selStatus, statusIds);

  const filteredGrp = useMemo(() => {
    const q = grpSearch.trim().toLowerCase();
    const list = groupOptions.filter(Boolean);
    if (!q) return list;
    return list.filter(g => g.label.toLowerCase().includes(q) || g.id.toLowerCase().includes(q));
  }, [groupOptions, grpSearch]);

  const filteredStatus = useMemo(() => {
    const q = statusSearch.trim().toLowerCase();
    const list = statusOptions.filter(Boolean);
    if (!q) return list;
    return list.filter(st => st.label.toLowerCase().includes(q) || st.id.toLowerCase().includes(q));
  }, [statusOptions, statusSearch]);

  const handleApply = () => {
    if (!canApply) return;
    const nextGroup = normalizeFilterAllSelection(selGroup, grpIds);
    const nextStatus = normalizeFilterAllSelection(selStatus, statusIds);
    onApply(selPeriod, nextGroup, nextStatus);
    onClose();
    const toastParts = [
      ...(selPeriod !== 'All' ? [t(PERIOD_LABEL_KEYS[selPeriod] ?? selPeriod)] : []),
      ...(nextGroup.length ? [nextGroup.length !== 1 ? t('screens.stocksBarcodes.groupsCountOther', { count: nextGroup.length }) : t('screens.stocksBarcodes.groupsCountOne', { count: nextGroup.length })] : []),
      ...(nextStatus.length ? [nextStatus.length !== 1 ? t('screens.stocksBarcodes.statusesCountOther', { count: nextStatus.length }) : t('screens.stocksBarcodes.statusesCountOne', { count: nextStatus.length })] : []),
    ];
    Toast.show({
      type: 'success',
      text1: toastParts.length ? t('screens.stocksBarcodes.filtersApplied') : t('screens.stocksBarcodes.filtersCleared'),
      text2: toastParts.length ? toastParts.join(' · ') : t('screens.stocksBarcodes.showingAllItems'),
      visibilityTime: 2000,
    });
  };

  return (
    <FilterBottomSheet
      visible={visible}
      onClose={onClose}
      title={t('screens.stocksBarcodes.filterTitle')}
      activeCount={activeCount}
      onClear={() => {
        setSelPeriod('All');
        setSelGroup([...grpIds]);
        setSelStatus([...statusIds]);
      }}
      onApply={handleApply}
      applyLabel={t('screens.stocksBarcodes.applyFilters')}
      applyDisabled={!canApply}
      heightFraction={0.72}
    >
      <View style={fm.tabs}>
        {(['Period', 'Group', 'Status'] as const).map(cat => (
          <TouchableOpacity
            key={cat}
            style={[fm.tab, tab === cat && fm.tabActive]}
            onPress={() => setTab(cat)}
            activeOpacity={0.7}
          >
            <Text style={[fm.tabTxt, tab === cat && fm.tabTxtActive]}>{t(FILTER_TAB_LABEL_KEYS[cat])}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'Period' ? (
        <View style={fm.panel}>
          {PERIODS.map(opt => (
            <FilterRadioRow
              key={opt}
              label={opt === 'All' ? t('screens.stocksBarcodes.allPeriods') : t(PERIOD_LABEL_KEYS[opt] ?? opt)}
              selected={selPeriod === opt}
              onPress={() => setSelPeriod(opt)}
            />
          ))}
        </View>
      ) : tab === 'Group' ? (
        <View style={fm.panel}>
          <View style={fm.searchBox}>
            <Ionicons name="search" size={14} color={COLORS.textTertiary} />
            <TextInput
              style={fm.searchInput}
              placeholder={t('screens.stocksBarcodes.searchGroup')}
              placeholderTextColor={COLORS.textTertiary}
              value={grpSearch}
              onChangeText={setGrpSearch}
            />
          </View>
          <FilterCheckRow
            label={t('screens.stocksBarcodes.allGroups')}
            selected={isAllGrp}
            onPress={() => setSelGroup(prev => toggleFilterAll(prev, grpIds))}
          />
          {groupOptions.length === 0 ? (
            <Text style={fm.hint}>{t('screens.stocksBarcodes.noGroups')}</Text>
          ) : filteredGrp.length === 0 ? (
            <Text style={fm.hint}>{t('screens.stocksBarcodes.noGroupsMatch')}</Text>
          ) : (
            filteredGrp.map(g => (
              <FilterCheckRow
                key={g.id}
                label={g.label}
                selected={isFilterOptionChecked(selGroup, g.id)}
                onPress={() => setSelGroup(prev => toggleFilterFromAll(prev, g.id, grpIds))}
              />
            ))
          )}
        </View>
      ) : (
        <View style={fm.panel}>
          <View style={fm.searchBox}>
            <Ionicons name="search" size={14} color={COLORS.textTertiary} />
            <TextInput
              style={fm.searchInput}
              placeholder={t('screens.stocksBarcodes.searchStatus')}
              placeholderTextColor={COLORS.textTertiary}
              value={statusSearch}
              onChangeText={setStatusSearch}
            />
          </View>
          <FilterCheckRow
            label={t('screens.stocksBarcodes.allStatuses')}
            selected={isAllStatus}
            onPress={() => setSelStatus(prev => toggleFilterAll(prev, statusIds))}
          />
          {filteredStatus.length === 0 ? (
            <Text style={fm.hint}>{t('screens.stocksBarcodes.noStatusesMatch')}</Text>
          ) : (
            filteredStatus.map(st => (
              <FilterCheckRow
                key={st.id}
                label={st.label}
                selected={isFilterOptionChecked(selStatus, st.id)}
                onPress={() => setSelStatus(prev => toggleFilterFromAll(prev, st.id, statusIds))}
              />
            ))
          )}
        </View>
      )}
    </FilterBottomSheet>
  );
}

// ─── Real CODE128B barcode SVG (scannable) ──────────────────────────────
// Uses integer virtual coordinates + viewBox scaling so bar ratios (1:2:3:4)
// are preserved exactly — no floating-point drift, no sub-pixel misreads.
function BarcodeSVG({ code, width, height = 90 }: { code: string; width: number; height?: number }) {
  const { bars, totalModules } = encodeCode128B(code);
  if (!bars.length || !totalModules) return null;

  const QUIET = 10;                        // 10 quiet modules each side (CODE128 spec)
  const totalWithQuiet = totalModules + QUIET * 2;
  const VMOD = 3;                          // virtual units per module (integer → no float drift)
  const vw   = totalWithQuiet * VMOD;      // virtual canvas width

  const rects: React.ReactElement[] = [];
  let mp = QUIET;                          // integer module position — no accumulation error
  bars.forEach((modules, i) => {
    if (i % 2 === 0) {                     // even = black bar
      rects.push(<Rect key={i} x={mp * VMOD} y={0} width={modules * VMOD} height={height} fill="#000" />);
    }
    mp += modules;
  });

  // preserveAspectRatio="none" scales x and y independently:
  // x-axis: vw → width (uniform bar scaling, exact ratios kept)
  // y-axis: height → height (bars fill full height)
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${vw} ${height}`} preserveAspectRatio="none">
      {rects}
    </Svg>
  );
}

const PERIODS  = ['All', 'Today', '7 Days', '30 Days'];
const PERIOD_LABEL_KEYS: Record<string, string> = {
  Today:     'screens.stocksBarcodes.periodToday',
  '7 Days':  'screens.stocksBarcodes.period7Days',
  '30 Days': 'screens.stocksBarcodes.period30Days',
};
const FILTER_TAB_LABEL_KEYS = {
  Period: 'screens.stocksBarcodes.tabPeriod',
  Group:  'screens.stocksBarcodes.tabGroup',
  Status: 'screens.stocksBarcodes.tabStatus',
} as const;
const STORAGE_MODE_LABEL_KEYS: Record<string, string> = {
  app_only:          'screens.stocksBarcodes.modeAppOnly',
  tally_alias:       'screens.stocksBarcodes.modeTallyAlias',
  tally_part_number: 'screens.stocksBarcodes.modeTallyPartNumber',
  tally_udf:         'screens.stocksBarcodes.modeTallyUdf',
};
const BARCODE_TYPE_LABEL_KEYS: Record<string, string> = {
  CODE128: 'screens.stocksBarcodes.typeCode128',
  EAN13:   'screens.stocksBarcodes.typeEan13',
  EAN8:    'screens.stocksBarcodes.typeEan8',
  QR:      'screens.stocksBarcodes.typeQr',
  INTERNAL:'screens.stocksBarcodes.typeInternal',
};

export default function BarcodesScreen() {
  const { t } = useTranslation();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { company } = useAuth();
  const companyGuid = company?.guid ?? '';
  // ── Data state ─────────────────────────────────────────────────────────────
  const [items,     setItems]     = useState<BarcodeItem[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [groups,    setGroups]    = useState<string[]>(['All']);
  const [statuses,  setStatuses]  = useState<string[]>(['All', 'In Stock', 'Low Stock', 'Out of Stock', 'Linked', 'Unlinked']);
  const [summary,   setSummary]   = useState({ totalItems: 0, linked: 0, unlinked: 0, unlinkedInFilter: 0 });
  const [page,      setPage]      = useState(1);
  const [hasMore,   setHasMore]   = useState(false);

  // ── Filter state ────────────────────────────────────────────────────────────
  const [search,       setSearch]       = useState('');
  const [selPeriod,    setSelPeriod]    = useState('All');
  const [selGroup,     setSelGroup]     = useState<string[]>([]);
  const [selStatus,    setSelStatus]    = useState<string[]>([]);
  const [showFilter,   setShowFilter]   = useState(false);

  // ── Multi-select ────────────────────────────────────────────────────────────
  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set());
  const [isMultiSelect,  setIsMultiSelect]  = useState(false);

  // ── Generation state ────────────────────────────────────────────────────────
  const [generatingIds,  setGeneratingIds]  = useState<Set<string>>(new Set()); // per-row inline spinner
  const [generatingAll,  setGeneratingAll]  = useState(false);
  const [bulkJob,        setBulkJob]        = useState<BulkBarcodeJobStatus | null>(null);
  const bulkPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Modals ──────────────────────────────────────────────────────────────────
  const [importVisible,   setImportVisible]   = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [linkVisible,     setLinkVisible]     = useState(false);
  const [viewBarcodeItem, setViewBarcodeItem] = useState<BarcodeItem | null>(null);
  const [linkedActionItem, setLinkedActionItem] = useState<BarcodeItem | null>(null);

  const [pasteText,       setPasteText]       = useState('');
  const [importing,       setImporting]       = useState(false);

  // ── Link modal state ────────────────────────────────────────────────────────
  const [scannedCode,   setScannedCode]   = useState('');
  const [linkSearch,    setLinkSearch]    = useState('');
  const [linkResults,   setLinkResults]   = useState<BarcodeItem[]>([]);
  const [linking,       setLinking]       = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');

  // ── Settings state ──────────────────────────────────────────────────────────
  const [settings,         setSettings]         = useState<BarcodeSettings>({ barcodeStorageMode: 'app_only', defaultBarcodeType: 'CODE128', autoSyncToTally: false });
  const [settingsLoading,  setSettingsLoading]   = useState(false);
  const [settingsSaving,   setSettingsSaving]    = useState(false);
  const [draftSettings,    setDraftSettings]     = useState<BarcodeSettings>({ barcodeStorageMode: 'app_only', defaultBarcodeType: 'CODE128', autoSyncToTally: false });

  // ── Search debounce + barcode scan ref ─────────────────────────────────────
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const groupOptions = useMemo(
    () => groups.filter(g => g !== 'All').map(g => ({ id: g, label: g })),
    [groups],
  );
  const statusOptions = useMemo(
    () => statuses.filter(st => st !== 'All').map(st => ({ id: st, label: st })),
    [statuses],
  );
  const groupIds = useMemo(() => groupOptions.map(g => g.id), [groupOptions]);
  const statusIds = useMemo(() => statusOptions.map(st => st.id), [statusOptions]);

  const activeFilterCount = useMemo(() => {
    let n = selPeriod !== 'All' ? 1 : 0;
    if (isFilterNarrowing(selGroup, groupIds)) n += selGroup.length;
    if (isFilterNarrowing(selStatus, statusIds)) n += selStatus.length;
    return n;
  }, [selPeriod, selGroup, selStatus, groupIds, statusIds]);

  // ── Load data ───────────────────────────────────────────────────────────────
  const requestItems = useCallback(async (p = 1, reset = true) => {
    if (!companyGuid) return;
    return getBarcodeList(companyGuid, {
      period: selPeriod,
      group: selGroup.length ? selGroup.join(',') : 'All',
      status: selStatus.length ? selStatus.join(',') : 'All',
      search, page: p, pageSize: 50,
    })
      .then((res) => {
        const d = res?.data || res;
        if (reset) setItems(d.items || []);
        else setItems(prev => [...prev, ...(d.items || [])]);
        setGroups(d.filters?.groups || ['All']);
        setStatuses(d.filters?.statuses || ['All']);
        setSummary(d.summary || { totalItems: 0, linked: 0, unlinked: 0, unlinkedInFilter: 0 });
        const { page: pg, pageSize, total } = d.pagination || {};
        setHasMore((pg || 1) * (pageSize || 50) < (total || 0));
        setPage(p);
      })
      .catch(() => {
        if (p === 1) setItems([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [companyGuid, selPeriod, selGroup, selStatus, search]);

  const loadItems = useCallback(async (p = 1, reset = true) => {
    if (!companyGuid) return;
    setLoading(true);
    return requestItems(p, reset);
  }, [companyGuid, requestItems]);

  const [itemsDeps, setItemsDeps] = useState<unknown[] | null>(null);
  if (
    !itemsDeps || itemsDeps[0] !== companyGuid || itemsDeps[1] !== selPeriod ||
    itemsDeps[2] !== selGroup || itemsDeps[3] !== selStatus
  ) {
    setItemsDeps([companyGuid, selPeriod, selGroup, selStatus]);
    if (companyGuid) setLoading(true);
  }

  useEffect(() => { requestItems(1, true); }, [companyGuid, selPeriod, selGroup, selStatus]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadItems(1, true), 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  // ── Load barcode settings ──────────────────────────────────────────────────
  const loadSettings = useCallback(() => {
    if (!companyGuid) return;
    getBarcodeSettings(companyGuid)
      .then((res) => {
        const d = res?.data || res;
        setSettings(d);
        setDraftSettings(d);
      })
      .catch(() => { /* use defaults */ })
      .finally(() => { setSettingsLoading(false); });
  }, [companyGuid]);

  const [settingsDeps, setSettingsDeps] = useState<unknown[] | null>(null);
  if (!settingsDeps || settingsDeps[0] !== companyGuid) {
    setSettingsDeps([companyGuid]);
    if (companyGuid) setSettingsLoading(true);
  }

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const stopBulkPoll = useCallback(() => {
    if (bulkPollRef.current) {
      clearInterval(bulkPollRef.current);
      bulkPollRef.current = null;
    }
  }, []);

  const finishBulkJob = useCallback(async (job: BulkBarcodeJobStatus) => {
    stopBulkPoll();
    setBulkJob(null);
    setGeneratingAll(false);
    await loadItems(1, true);
    if (job.status === 'completed') {
      Toast.show({
        type: 'success',
        text1: i18n.t('screens.stocksBarcodes.barcodesGenerated'),
        text2: job.errors ? i18n.t('screens.stocksBarcodes.createdWithFailed', { created: job.generated, failed: job.errors }) : i18n.t('screens.stocksBarcodes.createdCount', { created: job.generated }),
        visibilityTime: 3000,
      });
    } else if (job.status === 'failed') {
      Alert.alert(i18n.t('screens.stocksBarcodes.generationFailed'), job.errorMessage || i18n.t('screens.stocksBarcodes.somethingWrongTryAgain'));
    }
  }, [loadItems, stopBulkPoll]);

  const pollBulkJob = useCallback(async (jobId: string) => {
    if (!companyGuid) return;
    try {
      const res = await getBulkBarcodeJobStatus(companyGuid, jobId);
      const job = res?.data;
      if (!job) return;
      setBulkJob(job);
      if (job.status === 'completed' || job.status === 'failed') {
        await finishBulkJob(job);
      }
    } catch { /* keep polling */ }
  }, [companyGuid, finishBulkJob]);

  const beginBulkJobPolling = useCallback((jobId: string) => {
    stopBulkPoll();
    pollBulkJob(jobId);
    bulkPollRef.current = setInterval(() => pollBulkJob(jobId), 1200);
  }, [pollBulkJob, stopBulkPoll]);

  // Resume progress UI if a job is still running (e.g. user navigated away and back)
  useEffect(() => {
    if (!companyGuid) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getActiveBulkBarcodeJob(companyGuid);
        const job = res?.data;
        if (cancelled || !job?.jobId || !['pending', 'running'].includes(job.status)) return;
        setBulkJob(job);
        setGeneratingAll(true);
        beginBulkJobPolling(job.jobId);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [companyGuid, beginBulkJobPolling]);

  useEffect(() => () => stopBulkPoll(), [stopBulkPoll]);

  // ── Link search (search stock items in already-loaded items) ─────────────
  const [linkSearchDeps, setLinkSearchDeps] = useState<unknown[] | null>(null);
  if (!linkSearchDeps || linkSearchDeps[0] !== linkSearch || linkSearchDeps[1] !== items) {
    setLinkSearchDeps([linkSearch, items]);
    if (linkSearch.trim()) {
      const q = linkSearch.toLowerCase();
      setLinkResults(items.filter(i =>
        i.displayName.toLowerCase().includes(q) ||
        (i.sku || '').toLowerCase().includes(q) ||
        i.name.toLowerCase().includes(q)
      ).slice(0, 20));
    }
  }

  const openLinkBarcodeSheet = useCallback((opts: {
    barcode?: string;
    scanned?: string;
    seedResults?: BarcodeItem[];
    delayMs?: number;
  }) => {
    const run = () => {
      if (opts.scanned !== undefined) setScannedCode(opts.scanned);
      if (opts.barcode !== undefined) setManualBarcode(opts.barcode);
      setLinkSearch('');
      setLinkResults(opts.seedResults ?? []);
      setLinkVisible(true);
    };
    if (opts.delayMs && opts.delayMs > 0) setTimeout(run, opts.delayMs);
    else run();
  }, []);

  // ── Multi-select helpers ───────────────────────────────────────────────────
  const enterMultiSelect = (id: string) => {
    Vibration.vibrate(40);
    setIsMultiSelect(true);
    setSelectedIds(new Set([id]));
  };
  const toggleSelect = (id: string) => {
    if (!isMultiSelect) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      if (next.size === 0) setIsMultiSelect(false);
      return next;
    });
  };
  const exitMultiSelect = () => { setIsMultiSelect(false); setSelectedIds(new Set()); };

  // ── Scanner open — full-screen Jun 11 UI (Modal CameraView = black on iOS)
  const openScanner = () => {
    if (!companyGuid) {
      Alert.alert(t('screens.stocksBarcodes.noCompany'), t('screens.stocksBarcodes.selectCompanyBeforeScan'));
      return;
    }
    stocksBarcodeScan.set((result) => {
      if (result.found && result.item?.stockGuid) {
        safePush(router, `/stocks/item-detail?id=${encodeURIComponent(String(result.item.stockGuid))}` as any);
        return;
      }
      openLinkBarcodeSheet({
        scanned: result.barcode,
        barcode: result.barcode,
        delayMs: 350,
      });
    });
    safePush(router, `/stocks/barcode-scanner?companyGuid=${encodeURIComponent(companyGuid)}` as any);
  };

  // ── Generate barcode inline (single item, updates row in-place) ──────────
  const handleGenerateInline = async (item: BarcodeItem) => {
    if (!companyGuid || generatingIds.has(item.stockGuid)) return;
    setGeneratingIds(prev => new Set(prev).add(item.stockGuid));
    try {
      const res = await generateBarcode(companyGuid, item.stockGuid, settings.defaultBarcodeType, settings.barcodeStorageMode);
      const barcode = res?.data?.barcode || res?.barcode;
      // Update that single row in-place — no full list reload
      setItems(prev => prev.map(i =>
        i.stockGuid === item.stockGuid
          ? { ...i, barcode, barcodeStatus: 'active', source: 'app_generated' }
          : i
      ));
    } catch (err: any) {
      Alert.alert(t('screens.stocksBarcodes.couldNotGenerate'), err?.message || t('screens.stocksBarcodes.tryAgain'));
    } finally {
      setGeneratingIds(prev => { const n = new Set(prev); n.delete(item.stockGuid); return n; });
    }
  };

  const filtersActive = selPeriod !== 'All' || selGroup.length > 0 || selStatus.length > 0 || !!search.trim();

  // ── Generate All unlinked items (bulk) ────────────────────────────────────
  const handleGenerateAll = () => {
    const unlinkedCount = summary.unlinkedInFilter ?? summary.unlinked ?? 0;
    if (!unlinkedCount) {
      Alert.alert(t('screens.stocksBarcodes.allLinked'), filtersActive
        ? t('screens.stocksBarcodes.everyFilteredHasBarcode')
        : t('screens.stocksBarcodes.everyHasBarcode'));
      return;
    }
    const scopeLabel = filtersActive ? t('screens.stocksBarcodes.scopeFiltered') : t('screens.stocksBarcodes.scopeCompany');
    Alert.alert(
      t('screens.stocksBarcodes.generateAllTitle'),
      unlinkedCount !== 1
        ? t('screens.stocksBarcodes.generateAllMsgOther', { count: unlinkedCount, scope: scopeLabel })
        : t('screens.stocksBarcodes.generateAllMsgOne', { count: unlinkedCount, scope: scopeLabel }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('screens.stocksBarcodes.generateN', { count: unlinkedCount }), onPress: async () => {
          setGeneratingAll(true);
          try {
            const res = await startBulkBarcodeJob(companyGuid, {
              all: true,
              period: selPeriod,
              group: selGroup.length ? selGroup.join(',') : 'All',
              status: selStatus.length ? selStatus.join(',') : 'All',
              search,
              barcodeType: settings.defaultBarcodeType,
              syncTarget: settings.barcodeStorageMode,
            });
            const d = res?.data;
            if (!d?.jobId) {
              setGeneratingAll(false);
              if ((d?.generated ?? 0) === 0 && unlinkedCount === 0) {
                Alert.alert(t('screens.stocksBarcodes.allLinked'), t('screens.stocksBarcodes.everyFilteredHasBarcode'));
              } else {
                await loadItems(1, true);
              }
              return;
            }
            const job: BulkBarcodeJobStatus = {
              jobId: d.jobId,
              status: (d.status as BulkBarcodeJobStatus['status']) || 'pending',
              total: d.total ?? 0,
              processed: d.processed ?? 0,
              generated: d.generated ?? 0,
              errors: d.errors ?? 0,
              pct: d.total ? Math.round(((d.processed ?? 0) / d.total) * 100) : 0,
            };
            setBulkJob(job);
            beginBulkJobPolling(d.jobId);
          } catch (err: any) {
            setGeneratingAll(false);
            Alert.alert(t('common.error'), err?.message || t('screens.stocksBarcodes.couldNotStartBulk'));
          }
        }},
      ]
    );
  };

  // ── Add to Print Queue — auto-generates unlinked selected items first ─────
  const handleAddToPrintQueue = async () => {
    if (!companyGuid || !selectedIds.size) return;
    const needsBarcode = items.filter(i => selectedIds.has(i.stockGuid) && !i.barcode);
    if (needsBarcode.length > 0) {
      setGeneratingAll(true);
      try {
        await generateBulkBarcodes(companyGuid, {
          stockGuids:  needsBarcode.map(i => i.stockGuid),
          barcodeType: settings.defaultBarcodeType,
          syncTarget:  settings.barcodeStorageMode,
        });
      } catch { /* non-fatal — print continues */ }
      finally { setGeneratingAll(false); }
    }
    safePush(router, `/stocks/print-settings?ids=${encodeURIComponent(Array.from(selectedIds).join(','))}` as any);
  };

  // ── Link barcode (scan or manual field) to stock item ──────────────────────
  const handleLinkToItem = async (targetItem: BarcodeItem) => {
    const code = manualBarcode.trim() || scannedCode;
    if (!companyGuid || !code) return;
    const source = manualBarcode.trim() ? 'manual' : 'scan';
    setLinking(true);
    try {
      await linkBarcode(companyGuid, targetItem.stockGuid, code, 'CODE128', source, settings.barcodeStorageMode);
      setLinkVisible(false);
      setScannedCode('');
      setManualBarcode('');
      setLinkSearch('');
      Alert.alert(t('screens.stocksBarcodes.linked'), t('screens.stocksBarcodes.linkedMsg', { code, name: targetItem.displayName }));
      loadItems(1, true);
    } catch (err: any) {
      Alert.alert(t('screens.stocksBarcodes.linkFailed'), err?.message || t('screens.stocksBarcodes.couldNotLink'));
    } finally { setLinking(false); }
  };

  // ── Item tap — unlinked: generate inline; linked: open details ────────────
  const handleItemTap = (item: BarcodeItem) => {
    if (isMultiSelect) { toggleSelect(item.stockGuid); return; }
    if (generatingIds.has(item.stockGuid)) return; // already generating
    if (item.barcode) {
      setViewBarcodeItem(item);   // Show the scannable barcode image first
    } else {
      // Single tap on unlinked item → generate barcode immediately, no dialog
      handleGenerateInline(item);
    }
  };

  // ── Item long-press — multi-select (unlinked) or options sheet (linked) ───
  const handleItemLongPress = (item: BarcodeItem) => {
    if (isMultiSelect) { toggleSelect(item.stockGuid); return; }
    if (!item.barcode) { enterMultiSelect(item.stockGuid); return; }
    setLinkedActionItem(item);
  };

  // ── Import ─────────────────────────────────────────────────────────────────
  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['text/csv','text/plain','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'] });
      if (result.canceled) return;
      const file = result.assets?.[0];
      if (!file) return;
      const response = await fetch(file.uri);
      const text = await response.text();
      setPasteText(text);
    } catch { Alert.alert(t('common.error'), t('screens.stocksBarcodes.couldNotReadFile')); }
  };

  const handleImportSubmit = async () => {
    if (!companyGuid || (!pasteText.trim())) {
      Alert.alert(t('screens.stocksBarcodes.noData'), t('screens.stocksBarcodes.pasteOrUploadFirst'));
      return;
    }
    setImporting(true);
    try {
      const res = await bulkImportBarcodes(companyGuid, { text: pasteText });
      const d = res?.data || res;
      const s = d.summary;
      setImportVisible(false);
      setPasteText('');
      Alert.alert(
        t('screens.stocksBarcodes.importComplete'),
        t('screens.stocksBarcodes.importSummary', { imported: s.imported, duplicates: s.duplicates, needsReview: s.needsReview, invalid: s.invalid }),
        [{ text: t('common.ok'), onPress: () => loadItems(1, true) }],
      );
    } catch (err: any) {
      Alert.alert(t('screens.stocksBarcodes.importFailed'), err?.message || t('screens.stocksBarcodes.couldNotImport'));
    } finally { setImporting(false); }
  };

  // ── Save settings ──────────────────────────────────────────────────────────
  const handleSaveSettings = async () => {
    if (!companyGuid) return;
    setSettingsSaving(true);
    try {
      await saveBarcodeSettings(companyGuid, draftSettings);
      setSettings(draftSettings);
      setSettingsVisible(false);
      // Backend auto-triggers push for existing pending barcodes when autoSyncToTally=true
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.message || t('screens.stocksBarcodes.couldNotSaveSettings'));
    } finally { setSettingsSaving(false); }
  };

  // ── Download pre-filled barcode template ─────────────────────────────────
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const handleDownloadTemplate = async () => {
    if (!companyGuid || downloadingTemplate) return;
    setDownloadingTemplate(true);
    try {
      const csvText = await downloadBarcodeTemplate(companyGuid);
      const path = (FileSystem.cacheDirectory ?? '') + 'barcode_template.csv';
      await FileSystem.writeAsStringAsync(path, csvText, { encoding: FileSystem.EncodingType.UTF8 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(path, {
          mimeType: 'text/csv',
          dialogTitle: t('screens.stocksBarcodes.templateDialogTitle'),
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert(t('common.saved'), t('screens.stocksBarcodes.templateSaved'));
      }
    } catch (err: any) {
      Alert.alert(t('screens.stocksBarcodes.downloadFailed'), err?.message || t('screens.stocksBarcodes.couldNotDownloadTemplate'));
    } finally { setDownloadingTemplate(false); }
  };

  // ── Manual "Sync Now" ──────────────────────────────────────────────────────
  const [syncingNow, setSyncingNow] = useState(false);
  const handleSyncNow = async () => {
    if (!companyGuid || syncingNow) return;
    setSyncingNow(true);
    try {
      const res = await pushPendingBarcodes(companyGuid);
      const d = res?.data || res;
      Alert.alert(t('screens.stocksBarcodes.tallySync'), d?.message || t('screens.stocksBarcodes.syncedCount', { count: d?.synced ?? 0 }), [{ text: t('common.ok') }]);
      loadItems(1, true);
    } catch (err: any) {
      Alert.alert(t('screens.stocksBarcodes.syncFailed'), err?.message || t('screens.stocksBarcodes.couldNotPushTally'));
    } finally { setSyncingNow(false); }
  };

  // ── Render item row ────────────────────────────────────────────────────────
  const renderItem = ({ item }: { item: BarcodeItem }) => {
    const isSelected   = selectedIds.has(item.stockGuid);
    const isGenerating = generatingIds.has(item.stockGuid);
    const isLinked     = !!item.barcode;
    const subtitle     = isGenerating
      ? t('screens.stocksBarcodes.generatingBarcode')
      : item.barcode || item.sku || item.alias || t('screens.stocksBarcodes.tapToGenerate');
    return (
      <TouchableOpacity
        style={[s.itemRow, isSelected && s.itemRowSelected, isGenerating && s.itemRowGenerating]}
        onPress={() => handleItemTap(item)}
        onLongPress={() => handleItemLongPress(item)}
        activeOpacity={0.7}
        delayLongPress={350}
      >
        {isMultiSelect && (
          <View style={[s.checkbox, isSelected && s.checkboxActive]}>
            {isSelected && <Ionicons name="checkmark" size={13} color="#fff" />}
          </View>
        )}
        <View style={s.itemIconWrap}>
          {isGenerating
            ? <ActivityIndicator size="small" color={AMBER} />
            : <Ionicons name={isLinked ? 'barcode-outline' : 'cube-outline'} size={20} color={isLinked ? COLORS.textPrimary : COLORS.textSecondary} />}
        </View>
        <View style={s.itemInfo}>
          <Text style={s.itemName} numberOfLines={1}>{item.displayName}</Text>
          <Text style={[s.itemSku, !isLinked && !isGenerating && s.itemSkuNoBarcode, isGenerating && s.itemSkuGenerating]} numberOfLines={1}>{subtitle}</Text>
        </View>
        <Text style={s.itemQty}>{Math.round(item.currentQty).toLocaleString()}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* ── Multi-select banner */}
      {isMultiSelect && (
        <View style={s.selBanner}>
          <Text style={s.selBannerCount}>{t('common.selected', { count: selectedIds.size })}</Text>
          <TouchableOpacity onPress={exitMultiSelect} activeOpacity={0.7} style={s.selBannerClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Header */}
      {!isMultiSelect && (
        <View style={s.header}>
          <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>{t('screens.stocksBarcodes.barcode')}</Text>
          <View style={s.headerActions}>
            <TouchableOpacity style={s.headerIcon} onPress={openScanner} activeOpacity={0.7}>
              <Ionicons name="scan-outline" size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity style={s.headerIcon} onPress={() => setImportVisible(true)} activeOpacity={0.7}>
              <Ionicons name="cloud-upload-outline" size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity style={s.headerIcon} onPress={handleGenerateAll} activeOpacity={0.7} disabled={generatingAll}>
              {generatingAll
                ? <ActivityIndicator size="small" color={COLORS.textPrimary} />
                : <Ionicons name="flash-outline" size={20} color={COLORS.textPrimary} />}
            </TouchableOpacity>
            <TouchableOpacity style={s.headerIcon} onPress={() => { setDraftSettings({ ...settings }); setSettingsVisible(true); }} activeOpacity={0.7}>
              <Ionicons name="settings-outline" size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <FilterIconWithBadge count={activeFilterCount} onPress={() => setShowFilter(true)} />
          </View>
        </View>
      )}
      {/* ── Search + active filters */}
      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder={t('screens.stocksBarcodes.searchPlaceholder')}
        inputProps={{ returnKeyType: 'search' }}
      />
      <ActiveFilterChips
        variant="amber"
        chips={[
          ...(selPeriod !== 'All' ? [{ id: 'period', label: t(PERIOD_LABEL_KEYS[selPeriod] ?? selPeriod) }] : []),
          ...selGroup.map(g => ({ id: `grp:${g}`, label: g })),
          ...selStatus.map(st => ({ id: `st:${st}`, label: st })),
        ]}
        onRemove={(chipId) => {
          if (chipId === 'period') setSelPeriod('All');
          else if (chipId.startsWith('grp:')) setSelGroup(p => p.filter(x => x !== chipId.slice(4)));
          else if (chipId.startsWith('st:')) setSelStatus(p => p.filter(x => x !== chipId.slice(3)));
        }}
        onClearAll={() => { setSelPeriod('All'); setSelGroup([]); setSelStatus([]); }}
      />

      {/* ── Item list */}
      <FlatList
        data={items}
        keyExtractor={item => item.stockGuid}
        renderItem={renderItem}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={s.separator} />}
        refreshControl={
          <RefreshControl
            refreshing={loading && items.length > 0}
            onRefresh={() => loadItems(1, true)}
            tintColor={COLORS.brandPrimary}
          />
        }
        onEndReached={() => { if (hasMore && !loading) loadItems(page + 1, false); }}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={loading && items.length === 0 ? (
          <View style={s.emptyWrap}>
            <ActivityIndicator size="large" color={COLORS.brandPrimary} />
          </View>
        ) : null}
        ListEmptyComponent={!loading ? (
          <View style={s.emptyWrap}>
            <Ionicons name="barcode-outline" size={48} color={COLORS.textTertiary} />
            <Text style={s.emptyText}>{t('screens.stocksBarcodes.noItemsFound')}</Text>
          </View>
        ) : null}
        ListFooterComponent={loading && items.length > 0 ? (
          <View style={{ paddingVertical: 16, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={COLORS.brandPrimary} />
          </View>
        ) : null}
      />

      {/* ── Add to Print Queue sticky button */}
      {isMultiSelect && selectedIds.size > 0 && (
        <View style={[s.printQueueBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity style={s.printQueueBtn} onPress={handleAddToPrintQueue} activeOpacity={0.85} disabled={generatingAll}>
            {generatingAll
              ? <><ActivityIndicator size="small" color="#fff" /><Text style={s.printQueueBtnText}>{t('screens.stocksBarcodes.generatingBarcodesEllipsis')}</Text></>
              : <><Ionicons name="print-outline" size={18} color="#fff" /><Text style={s.printQueueBtnText}>{selectedIds.size > 1 ? t('screens.stocksBarcodes.generatePrintOther', { count: selectedIds.size }) : t('screens.stocksBarcodes.generatePrintOne', { count: selectedIds.size })}</Text></>}
          </TouchableOpacity>
        </View>
      )}

      {/* ════════════════════════════════════════════
          IMPORT BULK BARCODES MODAL
      ════════════════════════════════════════════ */}
      <BarcodeActionSheet
        visible={importVisible}
        onClose={() => setImportVisible(false)}
        title={t('screens.stocksBarcodes.importTitle')}
        footer={(
          <View style={s.importActions}>
            <TouchableOpacity style={s.importCancelBtn} onPress={() => setImportVisible(false)} activeOpacity={0.7}>
              <Text style={s.importCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.importSubmitBtn} onPress={handleImportSubmit} activeOpacity={0.8} disabled={importing}>
              {importing
                ? <ActivityIndicator size="small" color="#fff" />
                : <><Ionicons name="cloud-upload-outline" size={16} color="#fff" /><Text style={s.importSubmitText}>{t('screens.stocksBarcodes.import')}</Text></>}
            </TouchableOpacity>
          </View>
        )}
      >
        <TouchableOpacity style={s.dropZone} onPress={handlePickFile} activeOpacity={0.8}>
          <Ionicons name="cloud-upload-outline" size={36} color={COLORS.textTertiary} />
          <Text style={s.dropZoneText}>{t('screens.stocksBarcodes.tapChooseCsv')}</Text>
          <Text style={s.dropZoneSub}>{t('screens.stocksBarcodes.supportsCsv')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.templateLink}
          activeOpacity={0.7}
          onPress={handleDownloadTemplate}
          disabled={downloadingTemplate}
        >
          {downloadingTemplate
            ? <ActivityIndicator size="small" color={AMBER} />
            : <Ionicons name="download-outline" size={14} color={AMBER} />}
          <Text style={s.templateLinkText}>
            {downloadingTemplate ? t('screens.stocksBarcodes.downloading') : t('screens.stocksBarcodes.downloadTemplate')}
          </Text>
        </TouchableOpacity>
        <Text style={s.templateHint}>
          {t('screens.stocksBarcodes.templateHint')}
        </Text>
        <View style={s.orDivider}>
          <View style={s.orLine} />
          <Text style={s.orText}>{t('screens.stocksBarcodes.or')}</Text>
          <View style={s.orLine} />
        </View>
        <Text style={s.importLabel}>{t('screens.stocksBarcodes.pasteLabel')}</Text>
        <TextInput
          style={s.pasteInput}
          value={pasteText}
          onChangeText={setPasteText}
          multiline
          numberOfLines={5}
          placeholder={"8901234567890\nBlack JBL Speaker,4902780764600\n..."}
          placeholderTextColor={COLORS.textTertiary}
          textAlignVertical="top"
        />
      </BarcodeActionSheet>

      {/* ════════════════════════════════════════════
          BARCODE SETTINGS MODAL
      ════════════════════════════════════════════ */}
      <BarcodeActionSheet
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        title={t('screens.stocksBarcodes.settingsTitle')}
        footer={settingsLoading ? undefined : (
          <View style={s.importActions}>
            <TouchableOpacity style={s.importCancelBtn} onPress={() => setSettingsVisible(false)} activeOpacity={0.7}>
              <Text style={s.importCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.importSubmitBtn} onPress={handleSaveSettings} activeOpacity={0.8} disabled={settingsSaving}>
              {settingsSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.importSubmitText}>{t('screens.stocksBarcodes.saveSettings')}</Text>}
            </TouchableOpacity>
          </View>
        )}
      >
        {settingsLoading ? (
          <View style={{ padding: 32, alignItems: 'center' }}><ActivityIndicator size="large" color={COLORS.brandPrimary} /></View>
        ) : (
          <>
            <Text style={s.settingsSectionTitle}>{t('screens.stocksBarcodes.storageMode')}</Text>
            {Object.entries(STORAGE_MODE_LABEL_KEYS).map(([key, labelKey]) => (
              <TouchableOpacity key={key} style={s.settingsRow} onPress={() => setDraftSettings(d => ({ ...d, barcodeStorageMode: key }))} activeOpacity={0.7}>
                <View style={[s.settingsRadio, draftSettings.barcodeStorageMode === key && s.settingsRadioActive]}>
                  {draftSettings.barcodeStorageMode === key && <View style={s.settingsRadioDot} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.settingsRowLabel}>{t(labelKey)}</Text>
                  {key === 'app_only' && <Text style={s.settingsRowSub}>{t('screens.stocksBarcodes.appOnlySub')}</Text>}
                  {key === 'tally_alias' && <Text style={s.settingsRowSub}>{t('screens.stocksBarcodes.tallyAliasSub')}</Text>}
                </View>
              </TouchableOpacity>
            ))}

            <Text style={[s.settingsSectionTitle, { marginTop: 20 }]}>{t('screens.stocksBarcodes.defaultType')}</Text>
            {Object.entries(BARCODE_TYPE_LABEL_KEYS).map(([key, labelKey]) => (
              <TouchableOpacity key={key} style={s.settingsRow} onPress={() => setDraftSettings(d => ({ ...d, defaultBarcodeType: key }))} activeOpacity={0.7}>
                <View style={[s.settingsRadio, draftSettings.defaultBarcodeType === key && s.settingsRadioActive]}>
                  {draftSettings.defaultBarcodeType === key && <View style={s.settingsRadioDot} />}
                </View>
                <Text style={s.settingsRowLabel}>{t(labelKey)}</Text>
              </TouchableOpacity>
            ))}

            <View style={[s.settingsRow, { marginTop: 20 }]}>
              <View style={{ flex: 1 }}>
                <Text style={s.settingsRowLabel}>{t('screens.stocksBarcodes.autoSync')}</Text>
                <Text style={s.settingsRowSub}>{t('screens.stocksBarcodes.autoSyncSub')}</Text>
              </View>
              <Switch
                value={draftSettings.autoSyncToTally}
                onValueChange={v => setDraftSettings(d => ({ ...d, autoSyncToTally: v }))}
                trackColor={{ false: COLORS.borderDefault, true: COLORS.brandPrimary }}
                thumbColor="#fff"
              />
            </View>

            {settings.barcodeStorageMode !== 'app_only' && (
              <TouchableOpacity
                style={[s.syncNowBtn, syncingNow && { opacity: 0.5 }]}
                onPress={handleSyncNow}
                activeOpacity={0.8}
                disabled={syncingNow}
              >
                {syncingNow
                  ? <ActivityIndicator size="small" color={AMBER} />
                  : <Ionicons name="cloud-upload-outline" size={16} color={AMBER} />}
                <Text style={s.syncNowBtnText}>
                  {syncingNow ? t('screens.stocksBarcodes.syncing') : t('screens.stocksBarcodes.syncPendingNow')}
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </BarcodeActionSheet>

      <BarcodeFilterModal
        visible={showFilter}
        onClose={() => setShowFilter(false)}
        initPeriod={selPeriod}
        initGroup={selGroup}
        initStatus={selStatus}
        groupOptions={groupOptions}
        statusOptions={statusOptions}
        onApply={(period, groups, statuses) => {
          setSelPeriod(period);
          setSelGroup(groups);
          setSelStatus(statuses);
        }}
      />

      {/* Linked item long-press actions */}
      <BarcodeActionSheet
        visible={!!linkedActionItem}
        onClose={() => setLinkedActionItem(null)}
        title={linkedActionItem?.displayName || t('screens.stocksBarcodes.itemActions')}
        heightFraction={0.36}
      >
        <TouchableOpacity
          style={s.itemActionRow}
          activeOpacity={0.7}
          onPress={() => {
            if (linkedActionItem) enterMultiSelect(linkedActionItem.stockGuid);
            setLinkedActionItem(null);
          }}
        >
          <View style={s.itemActionIcon}>
            <Ionicons name="print-outline" size={18} color={COLORS.textPrimary} />
          </View>
          <Text style={s.itemActionLabel}>{t('screens.stocksBarcodes.selectForPrint')}</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={s.itemActionRow}
          activeOpacity={0.7}
          onPress={() => {
            if (!linkedActionItem) return;
            const item = linkedActionItem;
            setLinkedActionItem(null);
            openLinkBarcodeSheet({
              barcode: item.barcode || '',
              seedResults: [item],
              delayMs: 350,
            });
          }}
        >
          <View style={s.itemActionIcon}>
            <Ionicons name="link-outline" size={18} color={COLORS.textPrimary} />
          </View>
          <Text style={s.itemActionLabel}>{t('screens.stocksBarcodes.linkDifferent')}</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
        </TouchableOpacity>
      </BarcodeActionSheet>

      <FilterBottomSheet
        visible={linkVisible}
        onClose={() => setLinkVisible(false)}
        title={t('screens.stocksBarcodes.linkTitle')}
        heightFraction={0.72}
        hideFooter
        onApply={() => setLinkVisible(false)}
      >
        <View style={fm.panel}>
          <Text style={s.linkFieldLabel}>{t('screens.stocksBarcodes.barcode')}</Text>
          <View style={fm.searchBox}>
            <Ionicons name="barcode-outline" size={14} color={COLORS.textTertiary} />
            <TextInput
              style={fm.searchInput}
              value={manualBarcode}
              onChangeText={setManualBarcode}
              placeholder={t('screens.stocksBarcodes.enterOrScan')}
              placeholderTextColor={COLORS.textTertiary}
              returnKeyType="next"
              autoCorrect={false}
            />
          </View>

          <Text style={s.linkFieldLabel}>{t('screens.stocksBarcodes.searchProduct')}</Text>
          <View style={fm.searchBox}>
            <Ionicons name="search" size={14} color={COLORS.textTertiary} />
            <TextInput
              style={fm.searchInput}
              placeholder={t('screens.stocksBarcodes.productNameOrSku')}
              placeholderTextColor={COLORS.textTertiary}
              value={linkSearch}
              onChangeText={setLinkSearch}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {linkSearch.length > 0 && (
              <TouchableOpacity onPress={() => setLinkSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={16} color={COLORS.textTertiary} />
              </TouchableOpacity>
            )}
          </View>

          {linkResults.length === 0 ? (
            <Text style={fm.hint}>
              {linkSearch.trim() ? t('screens.stocksBarcodes.noProductsMatch') : t('screens.stocksBarcodes.typeToSearch')}
            </Text>
          ) : (
            linkResults.map(item => (
              <TouchableOpacity
                key={item.stockGuid}
                style={s.linkResultRow}
                onPress={() => handleLinkToItem(item)}
                activeOpacity={0.7}
                disabled={linking}
              >
                <View style={s.linkResultInfo}>
                  <Text style={s.linkResultName} numberOfLines={1}>{item.displayName}</Text>
                  <Text style={s.linkResultSku}>{item.sku || item.alias || '—'}</Text>
                </View>
                {linking
                  ? <ActivityIndicator size="small" color={COLORS.brandPrimary} />
                  : <Ionicons name="link-outline" size={18} color={AMBER} />}
              </TouchableOpacity>
            ))
          )}
        </View>
      </FilterBottomSheet>

      {/* Bulk generate progress overlay */}
      <Modal visible={!!bulkJob} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={s.progressOverlay}>
          <View style={s.progressCard}>
            <View style={s.progressIconWrap}>
              <Ionicons name="flash" size={28} color={COLORS.brandPrimary} />
            </View>
            <Text style={s.progressTitle}>{t('screens.stocksBarcodes.generatingBarcodes')}</Text>
            <Text style={s.progressSub}>
              {t('screens.stocksBarcodes.itemsProcessed', { processed: bulkJob?.processed ?? 0, total: bulkJob?.total ?? 0 })}
            </Text>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${bulkJob?.pct ?? 0}%` as any }]} />
            </View>
            <Text style={s.progressPct}>{bulkJob?.pct ?? 0}%</Text>
            <Text style={s.progressHint}>
              {t('screens.stocksBarcodes.progressHint')}
            </Text>
            {(bulkJob?.generated ?? 0) > 0 && (
              <Text style={s.progressStat}>
                {bulkJob?.errors ? t('screens.stocksBarcodes.generatedWithFailed', { generated: bulkJob?.generated, failed: bulkJob.errors }) : t('screens.stocksBarcodes.generatedCount', { generated: bulkJob?.generated })}
              </Text>
            )}
          </View>
        </View>
      </Modal>

      {/* ════════════════════════════════════════════
          VIEW BARCODE MODAL — shows real scannable CODE128 image
      ════════════════════════════════════════════ */}
      <Modal visible={!!viewBarcodeItem} animationType="fade" transparent onRequestClose={() => setViewBarcodeItem(null)}>
        <Pressable style={s.bcModalOverlay} onPress={() => setViewBarcodeItem(null)}>
          <Pressable style={s.bcModalCard} onPress={e => e.stopPropagation()}>
            {/* Handle */}
            <View style={s.bcModalHandle} />

            {/* Product name */}
            <Text style={s.bcModalTitle} numberOfLines={2}>
              {viewBarcodeItem?.displayName}
            </Text>

            {/* ━━ CODE128 barcode — fits screen width, no scroll ━━
                barcode must be fully visible in one frame for scanner to decode.
                bcImageWrap padding (16×2) + bcModalCard padding (24×2) = 80dp total.
                moduleW = (screenWidth-80) / (totalModules+20 quiet) ≥ 1.4dp → ~4px at 3× — scannable */}
            {viewBarcodeItem?.barcode ? (
              <View style={s.bcImageWrap}>
                <Text style={s.bcScanLabel}>
                  {t('screens.stocksBarcodes.pointScanner')}
                </Text>
                <BarcodeSVG
                  code={viewBarcodeItem.barcode}
                  width={screenWidth - 80}
                  height={100}
                />
                <Text style={s.bcValue}>{viewBarcodeItem.barcode}</Text>
              </View>
            ) : (
              <Text style={{ color: COLORS.textTertiary, fontSize: TYPOGRAPHY.sm, textAlign: 'center', paddingVertical: 24 }}>
                {t('screens.stocksBarcodes.noBarcodeLinked')}
              </Text>
            )}

            {/* Quick info row */}
            <View style={s.bcInfoRow}>
              {viewBarcodeItem?.sku ? (
                <View style={s.bcInfoChip}>
                  <Text style={s.bcInfoLabel}>SKU</Text>
                  <Text style={s.bcInfoVal}>{viewBarcodeItem.sku}</Text>
                </View>
              ) : null}
              <View style={s.bcInfoChip}>
                <Text style={s.bcInfoLabel}>{t('pdf.qty')}</Text>
                <Text style={s.bcInfoVal}>{Math.round(viewBarcodeItem?.currentQty ?? 0).toLocaleString()}</Text>
              </View>
              {viewBarcodeItem?.groupName ? (
                <View style={s.bcInfoChip}>
                  <Text style={s.bcInfoLabel}>{t('screens.stocksBarcodes.tabGroup')}</Text>
                  <Text style={s.bcInfoVal} numberOfLines={1}>{viewBarcodeItem.groupName}</Text>
                </View>
              ) : null}
            </View>

            {/* Actions */}
            <View style={s.bcActions}>
              <TouchableOpacity
                style={s.bcActionBtnPrimary}
                onPress={() => {
                  setViewBarcodeItem(null);
                  if (viewBarcodeItem) safePush(router, `/stocks/item-detail?id=${encodeURIComponent(String(viewBarcodeItem.stockGuid))}` as any);
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="open-outline" size={16} color="#fff" />
                <Text style={s.bcActionBtnPrimaryText}>{t('screens.stocksBarcodes.viewFullDetails')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.bcActionBtnSecondary}
                onPress={() => setViewBarcodeItem(null)}
                activeOpacity={0.8}
              >
                <Text style={s.bcActionBtnSecondaryText}>{t('common.close')}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.pageBg },

  selBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 10, backgroundColor: COLORS.activeBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  selBannerCount:  { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  selBannerClose:  { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  itemActionRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  itemActionIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center' },
  itemActionLabel:{ flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },

  progressOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.52)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.lg },
  progressCard:    { width: '100%', maxWidth: 340, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.xl, padding: SPACING.lg, alignItems: 'center', borderWidth: 1, borderColor: COLORS.borderDefault },
  progressIconWrap:{ width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.activeBg, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md },
  progressTitle:   { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 4 },
  progressSub:     { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, marginBottom: SPACING.md },
  progressTrack:   { width: '100%', height: 8, borderRadius: 4, backgroundColor: COLORS.pageBg, overflow: 'hidden', marginBottom: 6 },
  progressFill:      { height: 8, borderRadius: 4, backgroundColor: COLORS.brandPrimary },
  progressPct:       { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textSecondary, marginBottom: SPACING.sm },
  progressHint:      { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, textAlign: 'center', lineHeight: 18 },
  progressStat:      { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.brandPrimary, marginTop: SPACING.sm },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.sm, paddingVertical: 10, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  headerBtn:     { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle:   { flex: 1, fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  headerIcon:    { width: 38, height: 44, alignItems: 'center', justifyContent: 'center' },

  // Dim on flex root — absoluteFill inside transparent Modal collapses the scrim
  modalRoot:            { flex: 1, justifyContent: 'flex-end', backgroundColor: COLORS.overlay },
  modalBackdrop:        { flex: 1 },
  modalSheetContainer:  { width: '100%' },
  actionSheet:          { backgroundColor: COLORS.cardBg, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, paddingHorizontal: SPACING.md, width: '100%' },
  actionSheetHeader:    { width: '100%', alignSelf: 'stretch', paddingBottom: SPACING.sm },
  actionSheetBody:      { flex: 1, width: '100%' },
  actionSheetBodyContent: { paddingBottom: SPACING.sm, width: '100%' },
  actionSheetFooter:    { paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.borderDefault, width: '100%' },

  linkFieldLabel: {
    fontSize: TYPOGRAPHY.xs,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: 4,
  },

  searchWrap:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: SPACING.md, marginVertical: 10, paddingHorizontal: SPACING.md, paddingVertical: 11, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  searchInput: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, padding: 0 },

  listContent:   { paddingBottom: 16 },
  separator:     { height: 1, backgroundColor: COLORS.borderDefault, marginLeft: SPACING.md },
  itemRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: SPACING.md, paddingVertical: 14, backgroundColor: COLORS.cardBg },
  itemRowSelected: { backgroundColor: COLORS.activeBg },
  checkbox:        { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: COLORS.borderStrong, alignItems: 'center', justifyContent: 'center' },
  checkboxActive:  { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  itemIconWrap:  { width: 38, height: 38, borderRadius: RADIUS.md, backgroundColor: COLORS.hoverBg, alignItems: 'center', justifyContent: 'center' },
  itemInfo:      { flex: 1 },
  itemName:      { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  itemSku:       { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  itemSkuNoBarcode:  { color: COLORS.textTertiary, fontStyle: 'italic' },
  itemSkuGenerating: { color: AMBER, fontStyle: 'italic' },
  itemRowGenerating: { backgroundColor: '#FFFDF5' },
  itemQty:       { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, minWidth: 40, textAlign: 'right' },
  emptyWrap:     { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText:     { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary },

  printQueueBar: { paddingHorizontal: SPACING.md, paddingTop: SPACING.md, backgroundColor: COLORS.cardBg, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  printQueueBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: COLORS.brandPrimary, paddingVertical: 15, borderRadius: RADIUS.md },
  printQueueBtnText: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: '#fff' },

  modalHandle:   { width: 38, height: 4, borderRadius: 2, backgroundColor: COLORS.borderStrong, alignSelf: 'center', marginTop: 10, marginBottom: 6 },
  importHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  importTitle:   { fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  dropZone:      { borderWidth: 2, borderStyle: 'dashed', borderColor: COLORS.borderStrong, borderRadius: RADIUS.lg, paddingVertical: 36, alignItems: 'center', gap: 8, marginBottom: SPACING.sm },
  dropZoneText:  { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  dropZoneSub:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  templateLink:     { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', paddingVertical: 10 },
  templateLinkText:  { fontSize: TYPOGRAPHY.sm, color: '#A89060', fontWeight: '600' },
  templateHint:      { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, textAlign: 'center', paddingHorizontal: SPACING.md, marginBottom: SPACING.sm },
  orDivider:     { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: SPACING.md },
  orLine:        { flex: 1, height: 1, backgroundColor: COLORS.borderDefault },
  orText:        { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontWeight: '600' },
  importLabel:   { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  pasteInput:    { borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, padding: SPACING.md, minHeight: 100, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, backgroundColor: COLORS.pageBg },
  syncNowBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, marginTop: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: AMBER, backgroundColor: 'rgba(168,144,96,0.08)' },
  syncNowBtnText: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: AMBER },
  importActions: { flexDirection: 'row', gap: SPACING.sm },
  importCancelBtn: { flex: 1, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.borderStrong },
  importCancelText: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  importSubmitBtn:  { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary },
  importSubmitText: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: '#fff' },

  // Settings modal
  settingsSectionTitle: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },
  settingsRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  settingsRowLabel: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  settingsRowSub:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },
  settingsRadio:    { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: COLORS.borderStrong, alignItems: 'center', justifyContent: 'center' },
  settingsRadioActive: { borderColor: COLORS.brandPrimary },
  settingsRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.brandPrimary },

  // Link modal
  linkResultRow:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, gap: 12 },
  linkResultInfo: { flex: 1 },
  linkResultName: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  linkResultSku:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },

  // View Barcode modal
  bcModalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  bcModalCard:      { backgroundColor: COLORS.cardBg, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, paddingHorizontal: SPACING.lg, paddingBottom: 32, paddingTop: 4 },
  bcModalHandle:    { width: 38, height: 4, borderRadius: 2, backgroundColor: COLORS.borderStrong, alignSelf: 'center', marginBottom: 16, marginTop: 10 },
  bcModalTitle:     { fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center', marginBottom: 20 },
  bcImageWrap:      { alignItems: 'center', backgroundColor: '#fff', borderRadius: RADIUS.lg, paddingVertical: 20, paddingHorizontal: 16, borderWidth: 1, borderColor: COLORS.borderDefault, marginBottom: 16 },
  bcScanLabel:      { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginBottom: 12, textAlign: 'center' },
  bcScrollContent:  { paddingVertical: 4 },
  bcValue:          { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 12, letterSpacing: 2, fontFamily: 'monospace' },
  bcInfoRow:        { flexDirection: 'row', gap: 10, justifyContent: 'center', marginBottom: 20, flexWrap: 'wrap' },
  bcInfoChip:       { alignItems: 'center', backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: COLORS.borderDefault },
  bcInfoLabel:      { fontSize: 10, color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  bcInfoVal:        { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, maxWidth: 100 },
  bcActions:        { flexDirection: 'row', gap: 10 },
  bcActionBtnPrimary: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary },
  bcActionBtnPrimaryText: { color: '#fff', fontSize: TYPOGRAPHY.sm, fontWeight: '700' },
  bcActionBtnSecondary:   { flex: 1, alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.borderStrong },
  bcActionBtnSecondaryText: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
});
