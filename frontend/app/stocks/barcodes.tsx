import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Modal, FlatList, Pressable, Animated,
  KeyboardAvoidingView, Platform, Vibration, Alert, ActivityIndicator, Switch, RefreshControl,
} from 'react-native';
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
  generateBarcode, linkBarcode, lookupBarcode,
  bulkImportBarcodes, BarcodeItem, BarcodeSettings,
} from '../../src/services/api';

const AMBER = '#A89060';

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

  // ── Modals ──────────────────────────────────────────────────────────────────
  const [scannerVisible,  setScannerVisible]  = useState(false);
  const [importVisible,   setImportVisible]   = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [linkVisible,     setLinkVisible]     = useState(false);
  const [scanned,         setScanned]         = useState(false);
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

  // ── Search debounce ─────────────────────────────────────────────────────────
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
    if (!permission?.granted) await requestPermission();
    setScanned(false);
    setScannerVisible(true);
  };

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    Vibration.vibrate(100);
    setScannerVisible(false);
    if (!companyGuid) return;
    try {
      const res = await lookupBarcode(companyGuid, data);
      const d = res?.data || res;
      if (d.found && d.item?.stockGuid) {
        router.push(`/stocks/item-detail?id=${d.item.stockGuid}` as any);
      } else {
        // Barcode not found — offer to link
        setScannedCode(data);
        setManualBarcode(data);
        setLinkSearch('');
        setLinkResults([]);
        setLinkVisible(true);
      }
    } catch {
      Alert.alert('Scan Failed', 'Could not look up barcode. Try again.');
    }
  };

  // ── Add to Print Queue ─────────────────────────────────────────────────────
  const handleAddToPrintQueue = () => {
    const ids = Array.from(selectedIds).join(',');
    router.push(`/stocks/print-settings?ids=${ids}` as any);
  };

  // ── Generate barcode for item ──────────────────────────────────────────────
  const handleGenerateBarcode = async (item: BarcodeItem) => {
    if (!companyGuid) return;
    try {
      const res = await generateBarcode(companyGuid, item.stockGuid, settings.defaultBarcodeType, settings.barcodeStorageMode);
      const d = res?.data || res;
      Alert.alert('Barcode Generated', `${d.barcode}`, [
        { text: 'OK', onPress: () => loadItems(1, true) },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to generate barcode');
    }
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

  // ── Item tap ───────────────────────────────────────────────────────────────
  const handleItemTap = (item: BarcodeItem) => {
    if (isMultiSelect) { toggleSelect(item.stockGuid); return; }
    if (item.barcode) {
      router.push(`/stocks/item-detail?id=${item.stockGuid}` as any);
    } else {
      Alert.alert(item.displayName, 'No barcode linked.', [
        { text: 'Generate Barcode', onPress: () => handleGenerateBarcode(item) },
        { text: 'Link Barcode', onPress: () => { setScannedCode(''); setManualBarcode(''); setLinkSearch(''); setLinkResults([item]); setLinkVisible(true); } },
        { text: 'Open Details', onPress: () => router.push(`/stocks/item-detail?id=${item.stockGuid}` as any) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
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
    const isSelected = selectedIds.has(item.stockGuid);
    const subtitle   = item.barcode || item.sku || item.alias || 'No barcode linked';
    const isLinked   = !!item.barcode;
    return (
      <TouchableOpacity
        style={[s.itemRow, isSelected && s.itemRowSelected]}
        onPress={() => handleItemTap(item)}
        onLongPress={() => !isMultiSelect ? enterMultiSelect(item.stockGuid) : toggleSelect(item.stockGuid)}
        activeOpacity={0.7}
        delayLongPress={350}
      >
        {isMultiSelect && (
          <View style={[s.checkbox, isSelected && s.checkboxActive]}>
            {isSelected && <Ionicons name="checkmark" size={13} color="#fff" />}
          </View>
        )}
        <View style={s.itemIconWrap}>
          <Ionicons name={isLinked ? 'barcode-outline' : 'cube-outline'} size={20} color={isLinked ? AMBER : COLORS.textSecondary} />
        </View>
        <View style={s.itemInfo}>
          <Text style={s.itemName} numberOfLines={1}>{item.displayName}</Text>
          <Text style={[s.itemSku, !isLinked && s.itemSkuNoBarcode]} numberOfLines={1}>{subtitle}</Text>
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
          <TouchableOpacity style={s.printQueueBtn} onPress={handleAddToPrintQueue} activeOpacity={0.85}>
            <Ionicons name="print-outline" size={18} color="#fff" />
            <Text style={s.printQueueBtnText}>Add {selectedIds.size} item{selectedIds.size > 1 ? 's' : ''} to Print Queue</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ════════════════════════════════════════════
          BARCODE SCANNER MODAL
      ════════════════════════════════════════════ */}
      <Modal visible={scannerVisible} animationType="slide" onRequestClose={() => setScannerVisible(false)}>
        <View style={s.scannerModal}>
          {permission?.granted ? (
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
              barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'ean13', 'ean8', 'upc_a'] }}
            />
          ) : (
            <View style={s.scannerNoPermission}>
              <Ionicons name="camera-outline" size={60} color="rgba(255,255,255,0.4)" />
              <Text style={s.scannerNoPermText}>Camera permission required</Text>
              <TouchableOpacity style={s.permBtn} onPress={requestPermission} activeOpacity={0.8}>
                <Text style={s.permBtnText}>Grant Permission</Text>
              </TouchableOpacity>
            </View>
          )}
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
            <View style={s.scanDimBottom}>
              <Text style={s.scanHint}>Point camera at barcode or QR code</Text>
              <TouchableOpacity style={s.scanCloseBtn} onPress={() => setScannerVisible(false)} activeOpacity={0.8}>
                <Text style={s.scanCloseBtnText}>Cancel</Text>
              </TouchableOpacity>
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
  itemSkuNoBarcode: { color: COLORS.textTertiary, fontStyle: 'italic' },
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
});
