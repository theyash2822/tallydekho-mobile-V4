import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Modal, FlatList, Pressable, Animated,
  KeyboardAvoidingView, Platform, Vibration, Alert, ActivityIndicator, Switch, RefreshControl, Linking,
  useWindowDimensions,
} from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { encodeCode128B } from '../../src/utils/barcode';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as DocumentPicker from 'expo-document-picker';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useSettings } from '../../src/context/SettingsContext';
import { useAuth } from '../../src/context/AuthContext';
import {
  getBarcodeList, getBarcodeSettings, saveBarcodeSettings,
  generateBarcode, generateBulkBarcodes, linkBarcode, lookupBarcode,
  bulkImportBarcodes, BarcodeItem, BarcodeSettings,
} from '../../src/services/api';

const AMBER = '#A89060';

// ─── Real CODE128B barcode SVG component (scannable) ─────────────────────────
function BarcodeSVG({ code, width, height = 80 }: { code: string; width: number; height?: number }) {
  const { bars, totalModules } = encodeCode128B(code);
  if (!bars.length || !totalModules) return null;
  const moduleW = width / totalModules;
  const rects: React.ReactElement[] = [];
  let x = 0;
  bars.forEach((modules, i) => {
    const w = modules * moduleW;
    if (i % 2 === 0) {
      rects.push(<Rect key={i} x={x} y={0} width={w} height={height} fill="#000" />);
    }
    x += w;
  });
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {rects}
    </Svg>
  );
}

const PERIODS  = ['All', 'Today', '7 Days', '30 Days'];
const STORAGE_MODE_LABELS: Record<string, string> = {
  app_only:          'App Only',
  tally_alias:       'Sync to Tally Alias',
  tally_part_number: 'Sync to Tally Part Number',
  tally_udf:         'Sync to Tally UDF',
};
const BARCODE_TYPE_LABELS: Record<string, string> = {
  CODE128: 'CODE128 (default)',
  EAN13:   'EAN-13',
  EAN8:    'EAN-8',
  QR:      'QR Code',
  INTERNAL:'Internal',
};

export default function BarcodesScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { company } = useAuth();
  const companyGuid = company?.guid ?? '';
  const [permission, requestPermission] = useCameraPermissions();

  // ── Data state ─────────────────────────────────────────────────────────────
  const [items,     setItems]     = useState<BarcodeItem[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [groups,    setGroups]    = useState<string[]>(['All']);
  const [statuses,  setStatuses]  = useState<string[]>(['All', 'In Stock', 'Low Stock', 'Out of Stock', 'Linked', 'Unlinked']);
  const [summary,   setSummary]   = useState({ totalItems: 0, linked: 0, unlinked: 0 });
  const [page,      setPage]      = useState(1);
  const [hasMore,   setHasMore]   = useState(false);

  // ── Filter state ────────────────────────────────────────────────────────────
  const [search,    setSearch]       = useState('');
  const [selPeriod, setSelPeriod]    = useState('All');
  const [selGroup,  setSelGroup]     = useState('All');
  const [selStatus, setSelStatus]    = useState('All');
  const [periodOpen, setPeriodOpen]  = useState(false);
  const [groupOpen,  setGroupOpen]   = useState(false);
  const [statusOpen, setStatusOpen]  = useState(false);

  // ── Multi-select ────────────────────────────────────────────────────────────
  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set());
  const [isMultiSelect,  setIsMultiSelect]  = useState(false);

  // ── Generation state ────────────────────────────────────────────────────────
  const [generatingIds,  setGeneratingIds]  = useState<Set<string>>(new Set()); // per-row inline spinner
  const [generatingAll,  setGeneratingAll]  = useState(false);                  // bulk in-progress

  // ── Modals ──────────────────────────────────────────────────────────────────
  const [scannerVisible,  setScannerVisible]  = useState(false);
  const [importVisible,   setImportVisible]   = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [linkVisible,     setLinkVisible]     = useState(false);
  const [scanned,         setScanned]         = useState(false);
  const [viewBarcodeItem, setViewBarcodeItem] = useState<BarcodeItem | null>(null);

  // Ref-based guard: synchronous, no stale-closure issues.
  // Camera fires onBarcodeScanned many times per second — ref blocks all
  // subsequent calls after the first one until the user resets.
  const isProcessingRef = useRef(false);

  // ── Scan result state (shown in-scanner overlay) ──────────────────────────
  type ScanResult = {
    found:    boolean;
    barcode:  string;
    item?: {
      stockGuid:   string;
      displayName: string;
      sku:         string | null;
      barcode:     string;
      currentQty:  number;
      groupName:   string | null;
      unit:        string;
    };
  };
  const [scanLookingUp, setScanLookingUp] = useState(false);
  const [scanResult,    setScanResult]    = useState<ScanResult | null>(null);
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

  // ── Load data ───────────────────────────────────────────────────────────────
  const loadItems = useCallback(async (p = 1, reset = true) => {
    if (!companyGuid) return;
    setLoading(true);
    try {
      const res = await getBarcodeList(companyGuid, {
        period: selPeriod, group: selGroup, status: selStatus, search, page: p, pageSize: 50,
      });
      const d = res?.data || res;
      if (reset) setItems(d.items || []);
      else setItems(prev => [...prev, ...(d.items || [])]);
      setGroups(d.filters?.groups || ['All']);
      setStatuses(d.filters?.statuses || ['All']);
      setSummary(d.summary || { totalItems: 0, linked: 0, unlinked: 0 });
      const { page: pg, pageSize, total } = d.pagination || {};
      setHasMore((pg || 1) * (pageSize || 50) < (total || 0));
      setPage(p);
    } catch (err: any) {
      if (p === 1) setItems([]);
    } finally {
      setLoading(false);
    }
  }, [companyGuid, selPeriod, selGroup, selStatus, search]);

  useEffect(() => { loadItems(1, true); }, [companyGuid, selPeriod, selGroup, selStatus]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadItems(1, true), 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  // ── Load barcode settings ──────────────────────────────────────────────────
  const loadSettings = useCallback(async () => {
    if (!companyGuid) return;
    setSettingsLoading(true);
    try {
      const res = await getBarcodeSettings(companyGuid);
      const d = res?.data || res;
      setSettings(d);
      setDraftSettings(d);
    } catch { /* use defaults */ } finally { setSettingsLoading(false); }
  }, [companyGuid]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  // ── Link search (search stock items in already-loaded items) ─────────────
  useEffect(() => {
    if (!linkSearch.trim()) { setLinkResults([]); return; }
    const q = linkSearch.toLowerCase();
    setLinkResults(items.filter(i =>
      i.displayName.toLowerCase().includes(q) ||
      (i.sku || '').toLowerCase().includes(q) ||
      i.name.toLowerCase().includes(q)
    ).slice(0, 20));
  }, [linkSearch, items]);

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

  // ── Scanner ────────────────────────────────────────────────────────────────
  const openScanner = async () => {
    // Reset camera state — camera will activate only after onShow fires
    // Use returned result — not stale permission state from hook
    let granted = permission?.granted ?? false;

    if (!granted) {
      if (permission?.canAskAgain === false) {
        // OS-level denied — send to Settings
        Alert.alert(
          'Camera Access Denied',
          'TallyDekho needs camera access to scan barcodes.\n\nGo to Settings → Privacy → Camera → TallyDekho and enable it.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }
      // Ask for permission and use the RETURNED result (not stale hook value)
      const result = await requestPermission();
      granted = result?.granted ?? false;
    }

    if (!granted) {
      Alert.alert(
        'Camera Permission Required',
        'Please allow camera access to scan barcodes.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Only open modal after we know permission is granted
    resetScanner();
    setScannerVisible(true);
  };

  const handleBarcodeScanned = useCallback(async ({ data }: { data: string }) => {
    // Use ref (not state) as the guard — state is stale in closures when
    // the camera fires multiple events before React re-renders.
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    setScanned(true);  // Used to show result UI — not used to gate the CameraView prop
    Vibration.vibrate(100);
    setScanLookingUp(true);
    setScanResult(null);
    if (!companyGuid) {
      setScanLookingUp(false);
      isProcessingRef.current = false;  // Unlock if no company (edge case)
      return;
    }
    try {
      const res = await lookupBarcode(companyGuid, data);
      const d = res?.data || res;
      if (d.found && d.item?.stockGuid) {
        setScanResult({ found: true, barcode: data, item: d.item });
      } else {
        setScanResult({ found: false, barcode: data });
      }
    } catch {
      setScanResult({ found: false, barcode: data });
    } finally {
      setScanLookingUp(false);
      // Note: isProcessingRef stays true until user taps "Scan Again" or closes scanner
    }
  }, [companyGuid]);  // Stable reference — only recreated when companyGuid changes

  const resetScanner = () => {
    isProcessingRef.current = false;  // Allow new scan
    setScanned(false);
    setScanResult(null);
    setScanLookingUp(false);
  };

  const closeScanner = () => {
    isProcessingRef.current = false;
    setScannerVisible(false);
    resetScanner();
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
      Alert.alert('Could not generate', err?.message || 'Try again.');
    } finally {
      setGeneratingIds(prev => { const n = new Set(prev); n.delete(item.stockGuid); return n; });
    }
  };

  // ── Generate All unlinked items (bulk) ────────────────────────────────────
  const handleGenerateAll = () => {
    const unlinked = items.filter(i => !i.barcode);
    if (!unlinked.length) {
      Alert.alert('All linked', 'Every item already has a barcode.');
      return;
    }
    Alert.alert(
      'Generate All Barcodes',
      `Generate barcodes for ${unlinked.length} unlinked item${unlinked.length !== 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: `Generate ${unlinked.length}`, onPress: async () => {
          setGeneratingAll(true);
          try {
            const res = await generateBulkBarcodes(companyGuid, {
              all: true,
              barcodeType: settings.defaultBarcodeType,
              syncTarget:  settings.barcodeStorageMode,
            });
            const d = res?.data || res;
            await loadItems(1, true);
            Alert.alert('✅ Done', `Generated ${d.generated} barcodes${d.errors ? `, ${d.errors} failed` : '.'}`);
          } catch (err: any) {
            Alert.alert('Error', err?.message || 'Bulk generate failed');
          } finally { setGeneratingAll(false); }
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
    router.push(`/stocks/print-settings?ids=${Array.from(selectedIds).join(',')}` as any);
  };

  // ── Link scanned barcode to stock item ─────────────────────────────────────
  const handleLinkToItem = async (targetItem: BarcodeItem) => {
    if (!companyGuid || !scannedCode) return;
    setLinking(true);
    try {
      await linkBarcode(companyGuid, targetItem.stockGuid, scannedCode, 'CODE128', 'scan', settings.barcodeStorageMode);
      setLinkVisible(false);
      setScannedCode('');
      Alert.alert('Linked!', `"${scannedCode}" linked to ${targetItem.displayName}`);
      loadItems(1, true);
    } catch (err: any) {
      Alert.alert('Link Failed', err?.message || 'Could not link barcode');
    } finally { setLinking(false); }
  };

  // ── Link manually typed barcode ────────────────────────────────────────────
  const handleLinkManual = async (targetItem: BarcodeItem) => {
    if (!companyGuid || !manualBarcode.trim()) return;
    setLinking(true);
    try {
      await linkBarcode(companyGuid, targetItem.stockGuid, manualBarcode.trim(), 'CODE128', 'manual', settings.barcodeStorageMode);
      setLinkVisible(false);
      Alert.alert('Linked!', `"${manualBarcode.trim()}" linked to ${targetItem.displayName}`);
      loadItems(1, true);
    } catch (err: any) {
      Alert.alert('Link Failed', err?.message || 'Could not link barcode');
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

  // ── Item long-press — multi-select (unlinked) or options menu (linked) ────
  const handleItemLongPress = (item: BarcodeItem) => {
    if (isMultiSelect) { toggleSelect(item.stockGuid); return; }
    if (!item.barcode) { enterMultiSelect(item.stockGuid); return; }
    Alert.alert(item.displayName, item.barcode, [
      { text: '🔲 View Barcode Image', onPress: () => setViewBarcodeItem(item) },
      { text: 'Select for Print', onPress: () => enterMultiSelect(item.stockGuid) },
      { text: 'Link Different Barcode', onPress: () => { setScannedCode(''); setManualBarcode(item.barcode || ''); setLinkSearch(''); setLinkResults([item]); setLinkVisible(true); } },
      { text: 'Open Details', onPress: () => router.push(`/stocks/item-detail?id=${item.stockGuid}` as any) },
      { text: 'Cancel', style: 'cancel' },
    ]);
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
    } catch { Alert.alert('Error', 'Could not read file'); }
  };

  const handleImportSubmit = async () => {
    if (!companyGuid || (!pasteText.trim())) {
      Alert.alert('No data', 'Paste barcodes or upload a CSV file first.');
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
        'Import Complete',
        `Imported: ${s.imported}\nDuplicates: ${s.duplicates}\nNeeds Review: ${s.needsReview}\nInvalid: ${s.invalid}`,
        [{ text: 'OK', onPress: () => loadItems(1, true) }],
      );
    } catch (err: any) {
      Alert.alert('Import Failed', err?.message || 'Could not import barcodes');
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
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not save settings');
    } finally { setSettingsSaving(false); }
  };

  // ── Render item row ────────────────────────────────────────────────────────
  const renderItem = ({ item }: { item: BarcodeItem }) => {
    const isSelected   = selectedIds.has(item.stockGuid);
    const isGenerating = generatingIds.has(item.stockGuid);
    const isLinked     = !!item.barcode;
    const subtitle     = isGenerating
      ? 'Generating barcode…'
      : item.barcode || item.sku || item.alias || 'Tap to generate barcode';
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
            : <Ionicons name={isLinked ? 'barcode-outline' : 'cube-outline'} size={20} color={isLinked ? AMBER : COLORS.textSecondary} />}
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
          <Text style={s.selBannerText}>{selectedIds.size} selected</Text>
          <TouchableOpacity onPress={exitMultiSelect} activeOpacity={0.7}>
            <Text style={s.selBannerCancel}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Header */}
      {!isMultiSelect && (
        <View style={s.header}>
          <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Barcode</Text>
          <View style={s.headerActions}>
            <TouchableOpacity style={s.headerIcon} onPress={openScanner} activeOpacity={0.7}>
              <Ionicons name="scan-outline" size={22} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity style={s.headerIcon} onPress={() => setImportVisible(true)} activeOpacity={0.7}>
              <Ionicons name="cloud-upload-outline" size={22} color={COLORS.textPrimary} />
            </TouchableOpacity>
            {/* ⚡ Generate All unlinked items */}
            <TouchableOpacity style={s.headerIcon} onPress={handleGenerateAll} activeOpacity={0.7} disabled={generatingAll}>
              {generatingAll
                ? <ActivityIndicator size="small" color={COLORS.brandPrimary} />
                : <Ionicons name="flash-outline" size={22} color={COLORS.brandPrimary} />}
            </TouchableOpacity>
            <TouchableOpacity style={s.headerIcon} onPress={() => { setDraftSettings({ ...settings }); setSettingsVisible(true); }} activeOpacity={0.7}>
              <Ionicons name="settings-outline" size={21} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Filter chips */}
      <View style={s.filterRow}>
        <TouchableOpacity style={[s.filterChip, selPeriod !== 'All' && s.filterChipActive]} onPress={() => { setPeriodOpen(v => !v); setGroupOpen(false); setStatusOpen(false); }} activeOpacity={0.7}>
          <Ionicons name="calendar-outline" size={13} color={selPeriod !== 'All' ? '#fff' : COLORS.textSecondary} />
          <Text style={[s.filterChipText, selPeriod !== 'All' && s.filterChipTextActive]}>{selPeriod === 'All' ? 'Period' : selPeriod}</Text>
          <Ionicons name="chevron-down" size={12} color={selPeriod !== 'All' ? '#fff' : COLORS.textTertiary} />
        </TouchableOpacity>
        <TouchableOpacity style={[s.filterChip, selGroup !== 'All' && s.filterChipActive]} onPress={() => { setGroupOpen(v => !v); setPeriodOpen(false); setStatusOpen(false); }} activeOpacity={0.7}>
          <Ionicons name="layers-outline" size={13} color={selGroup !== 'All' ? '#fff' : COLORS.textSecondary} />
          <Text style={[s.filterChipText, selGroup !== 'All' && s.filterChipTextActive]}>{selGroup === 'All' ? 'Group' : selGroup}</Text>
          <Ionicons name="chevron-down" size={12} color={selGroup !== 'All' ? '#fff' : COLORS.textTertiary} />
        </TouchableOpacity>
        <TouchableOpacity style={[s.filterChip, selStatus !== 'All' && s.filterChipActive]} onPress={() => { setStatusOpen(v => !v); setPeriodOpen(false); setGroupOpen(false); }} activeOpacity={0.7}>
          <Ionicons name="checkmark-circle-outline" size={13} color={selStatus !== 'All' ? '#fff' : COLORS.textSecondary} />
          <Text style={[s.filterChipText, selStatus !== 'All' && s.filterChipTextActive]}>{selStatus === 'All' ? 'Status' : selStatus}</Text>
          <Ionicons name="chevron-down" size={12} color={selStatus !== 'All' ? '#fff' : COLORS.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* Inline filter dropdowns */}
      {periodOpen && (
        <View style={s.dropdownMenu}>
          {PERIODS.map(opt => (
            <TouchableOpacity key={opt} style={s.dropdownItem} onPress={() => { setSelPeriod(opt); setPeriodOpen(false); }} activeOpacity={0.7}>
              <Text style={[s.dropdownItemText, selPeriod === opt && s.dropdownItemTextActive]}>{opt}</Text>
              {selPeriod === opt && <Ionicons name="checkmark" size={14} color={AMBER} />}
            </TouchableOpacity>
          ))}
        </View>
      )}
      {groupOpen && (
        <View style={s.dropdownMenu}>
          {groups.map(opt => (
            <TouchableOpacity key={opt} style={s.dropdownItem} onPress={() => { setSelGroup(opt); setGroupOpen(false); }} activeOpacity={0.7}>
              <Text style={[s.dropdownItemText, selGroup === opt && s.dropdownItemTextActive]}>{opt}</Text>
              {selGroup === opt && <Ionicons name="checkmark" size={14} color={AMBER} />}
            </TouchableOpacity>
          ))}
        </View>
      )}
      {statusOpen && (
        <View style={s.dropdownMenu}>
          {statuses.map(opt => (
            <TouchableOpacity key={opt} style={s.dropdownItem} onPress={() => { setSelStatus(opt); setStatusOpen(false); }} activeOpacity={0.7}>
              <Text style={[s.dropdownItemText, selStatus === opt && s.dropdownItemTextActive]}>{opt}</Text>
              {selStatus === opt && <Ionicons name="checkmark" size={14} color={AMBER} />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── Search bar */}
      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={16} color={COLORS.textTertiary} />
        <TextInput
          style={s.searchInput}
          placeholder="Search by name, SKU or barcode..."
          placeholderTextColor={COLORS.textTertiary}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={16} color={COLORS.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

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
            <Text style={s.emptyText}>No items found</Text>
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
              ? <><ActivityIndicator size="small" color="#fff" /><Text style={s.printQueueBtnText}>Generating barcodes…</Text></>
              : <><Ionicons name="print-outline" size={18} color="#fff" /><Text style={s.printQueueBtnText}>Generate & Print {selectedIds.size} item{selectedIds.size > 1 ? 's' : ''}</Text></>}
          </TouchableOpacity>
        </View>
      )}

      {/* ════════════════════════════════════════════
          BARCODE SCANNER MODAL
      ════════════════════════════════════════════ */}
      <Modal
        visible={scannerVisible}
        animationType="slide"
        onRequestClose={closeScanner}
      >
        <View style={s.scannerModal}>
          {permission?.granted ? (
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              onBarcodeScanned={handleBarcodeScanned}
              barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'ean13', 'ean8', 'upc_a'] }}
            />
          ) : (
            <View style={s.scannerNoPermission}>
              <Ionicons name="camera-outline" size={60} color="rgba(255,255,255,0.4)" />
              <Text style={s.scannerNoPermText}>Camera permission required to scan barcodes</Text>
              {permission?.canAskAgain !== false ? (
                <TouchableOpacity style={s.permBtn} onPress={async () => {
                  const result = await requestPermission();
                  if (!result?.granted) {
                    Alert.alert('Permission Denied', 'Camera access is required to scan barcodes.');
                  }
                }} activeOpacity={0.8}>
                  <Text style={s.permBtnText}>Grant Permission</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={s.permBtn} onPress={() => Linking.openSettings()} activeOpacity={0.8}>
                  <Text style={s.permBtnText}>Open Settings</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={closeScanner} activeOpacity={0.7} style={{ marginTop: 8 }}>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: TYPOGRAPHY.sm }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Scan frame overlay ── */}
          <View style={s.scanOverlay}>
            <View style={s.scanDimTop} />
            <View style={s.scanMiddleRow}>
              <View style={s.scanDimSide} />
              <View style={s.scanFrame}>
                <View style={[s.corner, s.cornerTL]} />
                <View style={[s.corner, s.cornerTR]} />
                <View style={[s.corner, s.cornerBL]} />
                <View style={[s.corner, s.cornerBR]} />
              </View>
              <View style={s.scanDimSide} />
            </View>

            {/* ── Bottom: hint / looking-up spinner / scan result panel ── */}
            <View style={s.scanDimBottom}>
              {/* No result yet — show hint */}
              {!scanLookingUp && !scanResult && (
                <>
                  <Text style={s.scanHint}>Point camera at barcode or QR code</Text>
                  <TouchableOpacity style={s.scanCloseBtn} onPress={closeScanner} activeOpacity={0.8}>
                    <Text style={s.scanCloseBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* Looking up — spinner */}
              {scanLookingUp && (
                <View style={s.scanResultPanel}>
                  <ActivityIndicator size="large" color="#fff" />
                  <Text style={s.scanResultLooking}>Looking up barcode…</Text>
                </View>
              )}

              {/* Result panel — found */}
              {scanResult?.found && scanResult.item && (
                <View style={s.scanResultPanel}>
                  <View style={s.scanResultBadgeFound}>
                    <Ionicons name="checkmark-circle" size={16} color="#fff" />
                    <Text style={s.scanResultBadgeText}>Product Found</Text>
                  </View>

                  {/* Product info */}
                  <Text style={s.scanResultName} numberOfLines={2}>{scanResult.item.displayName}</Text>
                  <Text style={s.scanResultBarcode}>{scanResult.barcode}</Text>

                  <View style={s.scanResultMeta}>
                    <View style={s.scanResultMetaItem}>
                      <Text style={s.scanResultMetaLabel}>Qty</Text>
                      <Text style={s.scanResultMetaValue}>{Math.round(scanResult.item.currentQty).toLocaleString()} {scanResult.item.unit}</Text>
                    </View>
                    {scanResult.item.sku && (
                      <View style={s.scanResultMetaItem}>
                        <Text style={s.scanResultMetaLabel}>SKU</Text>
                        <Text style={s.scanResultMetaValue} numberOfLines={1}>{scanResult.item.sku}</Text>
                      </View>
                    )}
                    {scanResult.item.groupName && (
                      <View style={s.scanResultMetaItem}>
                        <Text style={s.scanResultMetaLabel}>Group</Text>
                        <Text style={s.scanResultMetaValue} numberOfLines={1}>{scanResult.item.groupName}</Text>
                      </View>
                    )}
                  </View>

                  {/* Actions */}
                  <View style={s.scanResultActions}>
                    <TouchableOpacity
                      style={s.scanResultBtnPrimary}
                      activeOpacity={0.85}
                      onPress={() => {
                        closeScanner();
                        router.push(`/stocks/item-detail?id=${scanResult.item!.stockGuid}` as any);
                      }}
                    >
                      <Ionicons name="open-outline" size={16} color="#fff" />
                      <Text style={s.scanResultBtnPrimaryText}>View Full Details</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.scanResultBtnSecondary} activeOpacity={0.8} onPress={resetScanner}>
                      <Ionicons name="scan-outline" size={16} color="#fff" />
                      <Text style={s.scanResultBtnSecondaryText}>Scan Again</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Result panel — not found */}
              {scanResult && !scanResult.found && (
                <View style={s.scanResultPanel}>
                  <View style={s.scanResultBadgeNotFound}>
                    <Ionicons name="help-circle" size={16} color="#fff" />
                    <Text style={s.scanResultBadgeText}>Not Linked</Text>
                  </View>

                  <Text style={s.scanResultName}>Barcode not linked to any product</Text>
                  <Text style={s.scanResultBarcode}>{scanResult.barcode}</Text>

                  <View style={s.scanResultActions}>
                    <TouchableOpacity
                      style={s.scanResultBtnPrimary}
                      activeOpacity={0.85}
                      onPress={() => {
                        closeScanner();
                        setScannedCode(scanResult.barcode);
                        setManualBarcode(scanResult.barcode);
                        setLinkSearch('');
                        setLinkResults([]);
                        setLinkVisible(true);
                      }}
                    >
                      <Ionicons name="link-outline" size={16} color="#fff" />
                      <Text style={s.scanResultBtnPrimaryText}>Link to Product</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.scanResultBtnSecondary} activeOpacity={0.8} onPress={resetScanner}>
                      <Ionicons name="scan-outline" size={16} color="#fff" />
                      <Text style={s.scanResultBtnSecondaryText}>Scan Again</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* ════════════════════════════════════════════
          IMPORT BULK BARCODES MODAL
      ════════════════════════════════════════════ */}
      <Modal visible={importVisible} animationType="slide" transparent onRequestClose={() => setImportVisible(false)}>
        <Pressable style={s.modalOverlay} onPress={() => setImportVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
            <Pressable style={s.importSheet} onPress={e => e.stopPropagation()}>
              <View style={s.modalHandle} />
              <View style={s.importHeader}>
                <Text style={s.importTitle}>Import Bulk Barcodes</Text>
                <TouchableOpacity onPress={() => setImportVisible(false)} activeOpacity={0.7}>
                  <Ionicons name="close" size={22} color={COLORS.textPrimary} />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <TouchableOpacity style={s.dropZone} onPress={handlePickFile} activeOpacity={0.8}>
                  <Ionicons name="cloud-upload-outline" size={36} color={COLORS.textTertiary} />
                  <Text style={s.dropZoneText}>Tap to choose CSV file</Text>
                  <Text style={s.dropZoneSub}>Supports .csv, .txt</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.templateLink} activeOpacity={0.7} onPress={() => {
                  Alert.alert('Template Columns', 'stock_guid, item_name, sku, barcode, barcode_type, is_primary, sync_target\n\nMinimum: item_name, barcode');
                }}>
                  <Ionicons name="download-outline" size={14} color={AMBER} />
                  <Text style={s.templateLinkText}>View Import Template</Text>
                </TouchableOpacity>
                <View style={s.orDivider}>
                  <View style={s.orLine} />
                  <Text style={s.orText}>OR</Text>
                  <View style={s.orLine} />
                </View>
                <Text style={s.importLabel}>Paste Barcodes (one per line, or item_name,barcode)</Text>
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
                <View style={s.importActions}>
                  <TouchableOpacity style={s.importCancelBtn} onPress={() => setImportVisible(false)} activeOpacity={0.7}>
                    <Text style={s.importCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.importSubmitBtn} onPress={handleImportSubmit} activeOpacity={0.8} disabled={importing}>
                    {importing
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <><Ionicons name="cloud-upload-outline" size={16} color="#fff" /><Text style={s.importSubmitText}>Import</Text></>}
                  </TouchableOpacity>
                </View>
                <View style={{ height: 40 }} />
              </ScrollView>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* ════════════════════════════════════════════
          BARCODE SETTINGS MODAL
      ════════════════════════════════════════════ */}
      <Modal visible={settingsVisible} animationType="slide" transparent onRequestClose={() => setSettingsVisible(false)}>
        <Pressable style={s.modalOverlay} onPress={() => setSettingsVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <Pressable style={s.importSheet} onPress={e => e.stopPropagation()}>
              <View style={s.modalHandle} />
              <View style={s.importHeader}>
                <Text style={s.importTitle}>Barcode Settings</Text>
                <TouchableOpacity onPress={() => setSettingsVisible(false)} activeOpacity={0.7}>
                  <Ionicons name="close" size={22} color={COLORS.textPrimary} />
                </TouchableOpacity>
              </View>
              {settingsLoading ? (
                <View style={{ padding: 32, alignItems: 'center' }}><ActivityIndicator size="large" color={COLORS.brandPrimary} /></View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Storage mode */}
                  <Text style={s.settingsSectionTitle}>Barcode Storage Mode</Text>
                  {Object.entries(STORAGE_MODE_LABELS).map(([key, label]) => (
                    <TouchableOpacity key={key} style={s.settingsRow} onPress={() => setDraftSettings(d => ({ ...d, barcodeStorageMode: key }))} activeOpacity={0.7}>
                      <View style={[s.settingsRadio, draftSettings.barcodeStorageMode === key && s.settingsRadioActive]}>
                        {draftSettings.barcodeStorageMode === key && <View style={s.settingsRadioDot} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.settingsRowLabel}>{label}</Text>
                        {key === 'app_only' && <Text style={s.settingsRowSub}>Barcodes work only inside TallyDekho</Text>}
                        {key === 'tally_alias' && <Text style={s.settingsRowSub}>Appends barcode to Tally stock item aliases</Text>}
                      </View>
                    </TouchableOpacity>
                  ))}

                  {/* Default barcode type */}
                  <Text style={[s.settingsSectionTitle, { marginTop: 20 }]}>Default Barcode Type</Text>
                  {Object.entries(BARCODE_TYPE_LABELS).map(([key, label]) => (
                    <TouchableOpacity key={key} style={s.settingsRow} onPress={() => setDraftSettings(d => ({ ...d, defaultBarcodeType: key }))} activeOpacity={0.7}>
                      <View style={[s.settingsRadio, draftSettings.defaultBarcodeType === key && s.settingsRadioActive]}>
                        {draftSettings.defaultBarcodeType === key && <View style={s.settingsRadioDot} />}
                      </View>
                      <Text style={s.settingsRowLabel}>{label}</Text>
                    </TouchableOpacity>
                  ))}

                  {/* Auto sync toggle */}
                  <View style={[s.settingsRow, { marginTop: 20 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.settingsRowLabel}>Auto Sync to Tally</Text>
                      <Text style={s.settingsRowSub}>Automatically queue Tally sync when barcode is generated</Text>
                    </View>
                    <Switch
                      value={draftSettings.autoSyncToTally}
                      onValueChange={v => setDraftSettings(d => ({ ...d, autoSyncToTally: v }))}
                      trackColor={{ false: COLORS.borderDefault, true: COLORS.brandPrimary }}
                      thumbColor="#fff"
                    />
                  </View>

                  <View style={s.importActions}>
                    <TouchableOpacity style={s.importCancelBtn} onPress={() => setSettingsVisible(false)} activeOpacity={0.7}>
                      <Text style={s.importCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.importSubmitBtn} onPress={handleSaveSettings} activeOpacity={0.8} disabled={settingsSaving}>
                      {settingsSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.importSubmitText}>Save Settings</Text>}
                    </TouchableOpacity>
                  </View>
                  <View style={{ height: 40 }} />
                </ScrollView>
              )}
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* ════════════════════════════════════════════
          LINK BARCODE MODAL
      ════════════════════════════════════════════ */}
      <Modal visible={linkVisible} animationType="slide" transparent onRequestClose={() => setLinkVisible(false)}>
        <Pressable style={s.modalOverlay} onPress={() => setLinkVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <Pressable style={s.importSheet} onPress={e => e.stopPropagation()}>
              <View style={s.modalHandle} />
              <View style={s.importHeader}>
                <Text style={s.importTitle}>Link Barcode to Product</Text>
                <TouchableOpacity onPress={() => setLinkVisible(false)} activeOpacity={0.7}>
                  <Ionicons name="close" size={22} color={COLORS.textPrimary} />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* Barcode value */}
                <Text style={s.importLabel}>Barcode</Text>
                <TextInput
                  style={[s.pasteInput, { minHeight: 44, paddingVertical: 12 }]}
                  value={manualBarcode}
                  onChangeText={setManualBarcode}
                  placeholder="Enter or scan barcode..."
                  placeholderTextColor={COLORS.textTertiary}
                  numberOfLines={1}
                  multiline={false}
                />
                {/* Search product */}
                <Text style={[s.importLabel, { marginTop: 12 }]}>Search Product</Text>
                <View style={[s.searchWrap, { marginHorizontal: 0, marginVertical: 0, marginBottom: 8 }]}>
                  <Ionicons name="search-outline" size={16} color={COLORS.textTertiary} />
                  <TextInput
                    style={s.searchInput}
                    placeholder="Product name or SKU..."
                    placeholderTextColor={COLORS.textTertiary}
                    value={linkSearch}
                    onChangeText={setLinkSearch}
                  />
                </View>
                {linkResults.map(item => (
                  <TouchableOpacity key={item.stockGuid} style={s.linkResultRow} onPress={() => handleLinkToItem(item)} activeOpacity={0.7} disabled={linking}>
                    <View style={s.linkResultInfo}>
                      <Text style={s.linkResultName} numberOfLines={1}>{item.displayName}</Text>
                      <Text style={s.linkResultSku}>{item.sku || item.alias || '—'}</Text>
                    </View>
                    {linking ? <ActivityIndicator size="small" color={COLORS.brandPrimary} /> : <Ionicons name="link-outline" size={18} color={AMBER} />}
                  </TouchableOpacity>
                ))}
                {linkSearch.length > 0 && linkResults.length === 0 && (
                  <Text style={{ color: COLORS.textTertiary, fontSize: TYPOGRAPHY.sm, textAlign: 'center', paddingVertical: 16 }}>No products found</Text>
                )}
                <View style={{ height: 40 }} />
              </ScrollView>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
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

            {/* ━━ Real CODE128 barcode image ━━ */}
            {viewBarcodeItem?.barcode ? (
              <View style={s.bcImageWrap}>
                <BarcodeSVG
                  code={viewBarcodeItem.barcode}
                  width={screenWidth - 96}
                  height={90}
                />
                {/* Barcode value text */}
                <Text style={s.bcValue}>{viewBarcodeItem.barcode}</Text>
              </View>
            ) : (
              <Text style={{ color: COLORS.textTertiary, fontSize: TYPOGRAPHY.sm, textAlign: 'center', paddingVertical: 24 }}>
                No barcode linked
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
                <Text style={s.bcInfoLabel}>Qty</Text>
                <Text style={s.bcInfoVal}>{Math.round(viewBarcodeItem?.currentQty ?? 0).toLocaleString()}</Text>
              </View>
              {viewBarcodeItem?.groupName ? (
                <View style={s.bcInfoChip}>
                  <Text style={s.bcInfoLabel}>Group</Text>
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
                  if (viewBarcodeItem) router.push(`/stocks/item-detail?id=${viewBarcodeItem.stockGuid}` as any);
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="open-outline" size={16} color="#fff" />
                <Text style={s.bcActionBtnPrimaryText}>View Full Details</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.bcActionBtnSecondary}
                onPress={() => setViewBarcodeItem(null)}
                activeOpacity={0.8}
              >
                <Text style={s.bcActionBtnSecondaryText}>Close</Text>
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

  selBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 14, backgroundColor: COLORS.brandPrimary },
  selBannerText:   { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: '#fff' },
  selBannerCancel: { fontSize: TYPOGRAPHY.sm, color: 'rgba(255,255,255,0.7)' },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.sm, paddingVertical: 10, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  headerBtn:     { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle:   { flex: 1, fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  headerActions: { flexDirection: 'row', gap: 2 },
  headerIcon:    { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },

  filterRow:           { flexDirection: 'row', gap: 8, paddingHorizontal: SPACING.md, paddingVertical: 10, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  filterChip:          { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.borderStrong, backgroundColor: COLORS.cardBg },
  filterChipActive:    { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  filterChipText:      { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  filterChipTextActive:{ color: '#fff' },

  dropdownMenu:           { backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, paddingHorizontal: SPACING.md },
  dropdownItem:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  dropdownItemText:       { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  dropdownItemTextActive: { fontWeight: '700', color: COLORS.textPrimary },

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

  scannerModal:        { flex: 1, backgroundColor: '#000' },
  scannerNoPermission: { flex: 1, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center', gap: 20 },
  scannerNoPermText:   { color: 'rgba(255,255,255,0.6)', fontSize: TYPOGRAPHY.base, textAlign: 'center', paddingHorizontal: 40 },
  permBtn:             { backgroundColor: COLORS.brandPrimary, paddingHorizontal: 28, paddingVertical: 12, borderRadius: RADIUS.full },
  permBtnText:         { color: '#fff', fontSize: TYPOGRAPHY.sm, fontWeight: '700' },
  scanOverlay:         { ...StyleSheet.absoluteFillObject },
  scanDimTop:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  scanMiddleRow:       { flexDirection: 'row', height: 200 },
  scanDimSide:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  scanFrame:           { width: 260, height: 200, position: 'relative' },
  corner:              { position: 'absolute', width: 28, height: 28 },
  cornerTL:            { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderColor: '#fff', borderTopLeftRadius: 4 },
  cornerTR:            { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderColor: '#fff', borderTopRightRadius: 4 },
  cornerBL:            { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: '#fff', borderBottomLeftRadius: 4 },
  cornerBR:            { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderColor: '#fff', borderBottomRightRadius: 4 },
  scanDimBottom:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 60, gap: 20 },
  scanHint:            { color: 'rgba(255,255,255,0.7)', fontSize: TYPOGRAPHY.sm, textAlign: 'center' },
  scanCloseBtn:        { paddingHorizontal: 36, paddingVertical: 13, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: RADIUS.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  scanCloseBtnText:    { color: '#fff', fontSize: TYPOGRAPHY.sm, fontWeight: '700' },

  // ── Scan result panel (shown inside scanner overlay)
  scanResultPanel:        { width: '100%', paddingHorizontal: 20, paddingVertical: 20, alignItems: 'center', gap: 10 },
  scanResultLooking:      { color: 'rgba(255,255,255,0.8)', fontSize: TYPOGRAPHY.sm, marginTop: 8 },
  scanResultBadgeFound:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 5, backgroundColor: '#22c55e', borderRadius: RADIUS.full },
  scanResultBadgeNotFound:{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 5, backgroundColor: AMBER,    borderRadius: RADIUS.full },
  scanResultBadgeText:    { color: '#fff', fontSize: TYPOGRAPHY.xs, fontWeight: '700' },
  scanResultName:         { fontSize: TYPOGRAPHY.md, fontWeight: '700', color: '#fff', textAlign: 'center', paddingHorizontal: 10 },
  scanResultBarcode:      { fontSize: TYPOGRAPHY.xs, color: 'rgba(255,255,255,0.6)', letterSpacing: 1.5, fontFamily: 'monospace' },
  scanResultMeta:         { flexDirection: 'row', gap: 16, marginTop: 2 },
  scanResultMetaItem:     { alignItems: 'center', gap: 2 },
  scanResultMetaLabel:    { fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5 },
  scanResultMetaValue:    { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: '#fff', maxWidth: 100 },
  scanResultActions:      { flexDirection: 'row', gap: 10, marginTop: 4, width: '100%' },
  scanResultBtnPrimary:   { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, borderRadius: RADIUS.full, backgroundColor: COLORS.brandPrimary },
  scanResultBtnPrimaryText:   { color: '#fff', fontSize: TYPOGRAPHY.sm, fontWeight: '700' },
  scanResultBtnSecondary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, borderRadius: RADIUS.full, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  scanResultBtnSecondaryText: { color: '#fff', fontSize: TYPOGRAPHY.xs, fontWeight: '700' },

  modalOverlay:  { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
  importSheet:   { backgroundColor: COLORS.cardBg, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, maxHeight: '85%', paddingHorizontal: SPACING.md },
  modalHandle:   { width: 38, height: 4, borderRadius: 2, backgroundColor: COLORS.borderStrong, alignSelf: 'center', marginTop: 10, marginBottom: 6 },
  importHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, marginBottom: SPACING.md },
  importTitle:   { fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  dropZone:      { borderWidth: 2, borderStyle: 'dashed', borderColor: COLORS.borderStrong, borderRadius: RADIUS.lg, paddingVertical: 36, alignItems: 'center', gap: 8, marginBottom: SPACING.sm },
  dropZoneText:  { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  dropZoneSub:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  templateLink:  { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', paddingVertical: 10 },
  templateLinkText: { fontSize: TYPOGRAPHY.sm, color: '#A89060', fontWeight: '600' },
  orDivider:     { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: SPACING.md },
  orLine:        { flex: 1, height: 1, backgroundColor: COLORS.borderDefault },
  orText:        { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontWeight: '600' },
  importLabel:   { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  pasteInput:    { borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, padding: SPACING.md, minHeight: 100, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, backgroundColor: COLORS.pageBg },
  importActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg },
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
  linkResultRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, gap: 12 },
  linkResultInfo: { flex: 1 },
  linkResultName: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  linkResultSku:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },

  // View Barcode modal
  bcModalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  bcModalCard:      { backgroundColor: COLORS.cardBg, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, paddingHorizontal: SPACING.lg, paddingBottom: 32, paddingTop: 4 },
  bcModalHandle:    { width: 38, height: 4, borderRadius: 2, backgroundColor: COLORS.borderStrong, alignSelf: 'center', marginBottom: 16, marginTop: 10 },
  bcModalTitle:     { fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center', marginBottom: 20 },
  bcImageWrap:      { alignItems: 'center', backgroundColor: '#fff', borderRadius: RADIUS.lg, paddingVertical: 20, paddingHorizontal: 16, borderWidth: 1, borderColor: COLORS.borderDefault, marginBottom: 16 },
  bcValue:          { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 10, letterSpacing: 2, fontFamily: 'monospace' },
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
