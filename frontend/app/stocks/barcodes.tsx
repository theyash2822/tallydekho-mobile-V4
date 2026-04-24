import React, { useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Modal, FlatList, Pressable, Animated,
  KeyboardAvoidingView, Platform, Vibration,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

const AMBER = '#A89060';

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_ITEMS = [
  { id: '1', name: 'Black JBL Speaker',     sku: 'PRD-1002-ABC', qty: 245,  barcode: '8901234567890', price: '₹2,499',  batch: 'B2024-01', expiry: '12/2025', group: 'Electronics' },
  { id: '2', name: 'Sony WH-1000XM5',       sku: 'SNY-001',      qty: 89,   barcode: '4902780764600', price: '₹28,990', batch: 'B2024-03', expiry: '06/2026', group: 'Electronics' },
  { id: '3', name: 'JBL Wired Speaker',     sku: 'JWS-456',      qty: 132,  barcode: '6925281932892', price: '₹1,299',  batch: 'B2023-12', expiry: '03/2025', group: 'Electronics' },
  { id: '4', name: 'Logitech MX Keys',      sku: 'LGT-MX01',     qty: 45,   barcode: '5099206080454', price: '₹8,995',  batch: 'B2024-02', expiry: '01/2027', group: 'Peripherals' },
  { id: '5', name: 'Apple USB-C Cable 2m',  sku: 'APL-C01',      qty: 300,  barcode: '0194253396160', price: '₹1,999',  batch: 'B2024-05', expiry: 'N/A',     group: 'Accessories' },
  { id: '6', name: 'Samsung Galaxy Buds',   sku: 'SAM-GB01',     qty: 67,   barcode: '8806090887666', price: '₹6,499',  batch: 'B2024-04', expiry: '07/2026', group: 'Electronics' },
  { id: '7', name: 'Boat Rockerz 450',      sku: 'BOAT-R450',    qty: 110,  barcode: '8906071579834', price: '₹1,499',  batch: 'B2023-11', expiry: '11/2025', group: 'Electronics' },
  { id: '8', name: 'HDMI Cable 3m',         sku: 'HDMI-3M',      qty: 78,   barcode: '6971169580018', price: '₹599',    batch: 'B2024-01', expiry: 'N/A',     group: 'Accessories' },
  { id: '9', name: 'Wireless Mouse Logitech', sku: 'LGT-MS01',   qty: 55,   barcode: '5099206084742', price: '₹2,295',  batch: 'B2024-03', expiry: 'N/A',     group: 'Peripherals' },
];

const GROUPS   = ['All', 'Electronics', 'Peripherals', 'Accessories'];
const PERIODS  = ['All', 'Today', '7 Days', '30 Days'];
const STATUSES = ['All', 'In Stock', 'Low Stock', 'Out of Stock'];

export default function BarcodesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();

  // ── State
  const [search, setSearch]               = useState('');
  const [selPeriod, setSelPeriod]         = useState('All');
  const [selGroup, setSelGroup]           = useState('All');
  const [selStatus, setSelStatus]         = useState('All');
  const [periodOpen, setPeriodOpen]       = useState(false);
  const [groupOpen, setGroupOpen]         = useState(false);
  const [statusOpen, setStatusOpen]       = useState(false);
  const [selectedIds, setSelectedIds]     = useState<Set<string>>(new Set());
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [importVisible, setImportVisible]   = useState(false);
  const [scanned, setScanned]             = useState(false);
  const [pasteText, setPasteText]         = useState('');

  // ── Filtered list
  const filtered = MOCK_ITEMS.filter(item => {
    const matchSearch = search.trim() === '' ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.sku.toLowerCase().includes(search.toLowerCase()) ||
      item.barcode.includes(search);
    const matchGroup = selGroup === 'All' || item.group === selGroup;
    return matchSearch && matchGroup;
  });

  // ── Multi-select helpers
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
      if (next.size === 0) { setIsMultiSelect(false); }
      return next;
    });
  };
  const exitMultiSelect = () => { setIsMultiSelect(false); setSelectedIds(new Set()); };

  // ── Scanner
  const openScanner = async () => {
    if (!permission?.granted) { await requestPermission(); }
    setScanned(false);
    setScannerVisible(true);
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    Vibration.vibrate(100);
    setScannerVisible(false);
    setSearch(data);
  };

  // ── Add to Print Queue
  const handleAddToPrintQueue = () => {
    const ids = Array.from(selectedIds).join(',');
    router.push(`/stocks/print-settings?ids=${ids}` as any);
  };

  // ── Render item row (defined outside, used as renderItem)
  const renderItem = ({ item }: { item: typeof MOCK_ITEMS[0] }) => {
    const isSelected = selectedIds.has(item.id);
    return (
      <TouchableOpacity
        style={[s.itemRow, isSelected && s.itemRowSelected]}
        onPress={() => isMultiSelect ? toggleSelect(item.id) : undefined}
        onLongPress={() => !isMultiSelect ? enterMultiSelect(item.id) : toggleSelect(item.id)}
        activeOpacity={0.7}
        delayLongPress={350}
      >
        {/* Checkbox (visible in multi-select mode) */}
        {isMultiSelect && (
          <View style={[s.checkbox, isSelected && s.checkboxActive]}>
            {isSelected && <Ionicons name="checkmark" size={13} color="#fff" />}
          </View>
        )}

        {/* Item icon */}
        <View style={s.itemIconWrap}>
          <Ionicons name="cube-outline" size={20} color={COLORS.textSecondary} />
        </View>

        {/* Info */}
        <View style={s.itemInfo}>
          <Text style={s.itemName} numberOfLines={1}>{item.name}</Text>
          <Text style={s.itemSku}>{item.sku}</Text>
        </View>

        {/* Qty */}
        <Text style={s.itemQty}>{item.qty.toLocaleString()}</Text>
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
          </View>
        </View>
      )}

      {/* ── Filter chips */}
      <View style={s.filterRow}>
        {/* Period */}
        <TouchableOpacity style={[s.filterChip, selPeriod !== 'All' && s.filterChipActive]} onPress={() => { setPeriodOpen(v => !v); setGroupOpen(false); setStatusOpen(false); }} activeOpacity={0.7}>
          <Ionicons name="calendar-outline" size={13} color={selPeriod !== 'All' ? '#fff' : COLORS.textSecondary} />
          <Text style={[s.filterChipText, selPeriod !== 'All' && s.filterChipTextActive]}>{selPeriod === 'All' ? 'Period' : selPeriod}</Text>
          <Ionicons name="chevron-down" size={12} color={selPeriod !== 'All' ? '#fff' : COLORS.textTertiary} />
        </TouchableOpacity>
        {/* Group */}
        <TouchableOpacity style={[s.filterChip, selGroup !== 'All' && s.filterChipActive]} onPress={() => { setGroupOpen(v => !v); setPeriodOpen(false); setStatusOpen(false); }} activeOpacity={0.7}>
          <Ionicons name="layers-outline" size={13} color={selGroup !== 'All' ? '#fff' : COLORS.textSecondary} />
          <Text style={[s.filterChipText, selGroup !== 'All' && s.filterChipTextActive]}>{selGroup === 'All' ? 'Group' : selGroup}</Text>
          <Ionicons name="chevron-down" size={12} color={selGroup !== 'All' ? '#fff' : COLORS.textTertiary} />
        </TouchableOpacity>
        {/* Status */}
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
          {GROUPS.map(opt => (
            <TouchableOpacity key={opt} style={s.dropdownItem} onPress={() => { setSelGroup(opt); setGroupOpen(false); }} activeOpacity={0.7}>
              <Text style={[s.dropdownItemText, selGroup === opt && s.dropdownItemTextActive]}>{opt}</Text>
              {selGroup === opt && <Ionicons name="checkmark" size={14} color={AMBER} />}
            </TouchableOpacity>
          ))}
        </View>
      )}
      {statusOpen && (
        <View style={s.dropdownMenu}>
          {STATUSES.map(opt => (
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
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={s.separator} />}
        ListEmptyComponent={
          <View style={s.emptyWrap}>
            <Ionicons name="barcode-outline" size={48} color={COLORS.textTertiary} />
            <Text style={s.emptyText}>No items found</Text>
          </View>
        }
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

      {/* ══════════════════════════════════════════
          BARCODE SCANNER MODAL
      ══════════════════════════════════════════ */}
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
              <Ionicons name="camera-off-outline" size={60} color="rgba(255,255,255,0.4)" />
              <Text style={s.scannerNoPermText}>Camera permission required</Text>
              <TouchableOpacity style={s.permBtn} onPress={requestPermission} activeOpacity={0.8}>
                <Text style={s.permBtnText}>Grant Permission</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Scan overlay */}
          <View style={s.scanOverlay}>
            {/* Top dim */}
            <View style={s.scanDimTop} />
            {/* Middle row */}
            <View style={s.scanMiddleRow}>
              <View style={s.scanDimSide} />
              {/* Scan frame */}
              <View style={s.scanFrame}>
                <View style={[s.corner, s.cornerTL]} />
                <View style={[s.corner, s.cornerTR]} />
                <View style={[s.corner, s.cornerBL]} />
                <View style={[s.corner, s.cornerBR]} />
              </View>
              <View style={s.scanDimSide} />
            </View>
            {/* Bottom dim + controls */}
            <View style={s.scanDimBottom}>
              <Text style={s.scanHint}>Point camera at barcode or QR code</Text>
              <TouchableOpacity style={s.scanCloseBtn} onPress={() => setScannerVisible(false)} activeOpacity={0.8}>
                <Text style={s.scanCloseBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════
          IMPORT BULK BARCODES MODAL
      ══════════════════════════════════════════ */}
      <Modal visible={importVisible} animationType="slide" transparent onRequestClose={() => setImportVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <Pressable style={s.modalOverlay} onPress={() => setImportVisible(false)}>
            <Pressable style={s.importSheet} onPress={e => e.stopPropagation()}>
              <View style={s.modalHandle} />
              <View style={s.importHeader}>
                <Text style={s.importTitle}>Import Bulk Barcodes</Text>
                <TouchableOpacity onPress={() => setImportVisible(false)} activeOpacity={0.7}>
                  <Ionicons name="close" size={22} color={COLORS.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* Drop zone */}
                <TouchableOpacity style={s.dropZone} activeOpacity={0.8}>
                  <Ionicons name="cloud-upload-outline" size={36} color={COLORS.textTertiary} />
                  <Text style={s.dropZoneText}>Tap to choose CSV file</Text>
                  <Text style={s.dropZoneSub}>Supports .csv, .xlsx</Text>
                </TouchableOpacity>

                {/* Template link */}
                <TouchableOpacity style={s.templateLink} activeOpacity={0.7}>
                  <Ionicons name="download-outline" size={14} color={AMBER} />
                  <Text style={s.templateLinkText}>Download Import Template</Text>
                </TouchableOpacity>

                <View style={s.orDivider}>
                  <View style={s.orLine} />
                  <Text style={s.orText}>OR</Text>
                  <View style={s.orLine} />
                </View>

                {/* Paste area */}
                <Text style={s.importLabel}>Paste Barcodes (one per line)</Text>
                <TextInput
                  style={s.pasteInput}
                  value={pasteText}
                  onChangeText={setPasteText}
                  multiline
                  numberOfLines={5}
                  placeholder="8901234567890&#10;4902780764600&#10;6925281932892..."
                  placeholderTextColor={COLORS.textTertiary}
                  textAlignVertical="top"
                />

                <View style={s.importActions}>
                  <TouchableOpacity style={s.importCancelBtn} onPress={() => setImportVisible(false)} activeOpacity={0.7}>
                    <Text style={s.importCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.importSubmitBtn} activeOpacity={0.8}>
                    <Ionicons name="cloud-upload-outline" size={16} color="#fff" />
                    <Text style={s.importSubmitText}>Import</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ height: 40 }} />
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.pageBg },

  // ── Multi-select banner
  selBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    backgroundColor: COLORS.brandPrimary,
  },
  selBannerText:   { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: '#fff' },
  selBannerCancel: { fontSize: TYPOGRAPHY.sm, color: 'rgba(255,255,255,0.7)' },

  // ── Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.sm, paddingVertical: 10,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  headerBtn:     { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle:   { flex: 1, fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  headerActions: { flexDirection: 'row', gap: 4 },
  headerIcon:    { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  // ── Filter chips
  filterRow:         { flexDirection: 'row', gap: 8, paddingHorizontal: SPACING.md, paddingVertical: 10, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  filterChip:        { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.borderStrong, backgroundColor: COLORS.cardBg },
  filterChipActive:  { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  filterChipText:    { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  filterChipTextActive: { color: '#fff' },

  // ── Inline dropdown
  dropdownMenu: {
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
    paddingHorizontal: SPACING.md,
  },
  dropdownItem:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  dropdownItemText:     { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  dropdownItemTextActive: { fontWeight: '700', color: COLORS.textPrimary },

  // ── Search bar
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: SPACING.md, marginVertical: 10,
    paddingHorizontal: SPACING.md, paddingVertical: 11,
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  searchInput: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, padding: 0 },

  // ── Item list
  listContent:   { paddingBottom: 16 },
  separator:     { height: 1, backgroundColor: COLORS.borderDefault, marginLeft: SPACING.md },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    backgroundColor: COLORS.cardBg,
  },
  itemRowSelected: { backgroundColor: COLORS.activeBg },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2,
    borderColor: COLORS.borderStrong, alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive:  { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  itemIconWrap: {
    width: 38, height: 38, borderRadius: RADIUS.md,
    backgroundColor: COLORS.hoverBg,
    alignItems: 'center', justifyContent: 'center',
  },
  itemInfo:   { flex: 1 },
  itemName:   { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  itemSku:    { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  itemQty:    { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, minWidth: 40, textAlign: 'right' },
  emptyWrap:  { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText:  { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary },

  // ── Print Queue bar
  printQueueBar: {
    paddingHorizontal: SPACING.md, paddingTop: SPACING.md,
    backgroundColor: COLORS.cardBg, borderTopWidth: 1, borderTopColor: COLORS.borderDefault,
  },
  printQueueBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: COLORS.brandPrimary, paddingVertical: 15, borderRadius: RADIUS.md,
  },
  printQueueBtnText: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: '#fff' },

  // ── Scanner modal
  scannerModal:      { flex: 1, backgroundColor: '#000' },
  scannerNoPermission: { flex: 1, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center', gap: 20 },
  scannerNoPermText: { color: 'rgba(255,255,255,0.6)', fontSize: TYPOGRAPHY.base, textAlign: 'center', paddingHorizontal: 40 },
  permBtn:           { backgroundColor: COLORS.brandPrimary, paddingHorizontal: 28, paddingVertical: 12, borderRadius: RADIUS.full },
  permBtnText:       { color: '#fff', fontSize: TYPOGRAPHY.sm, fontWeight: '700' },
  scanOverlay:       { ...StyleSheet.absoluteFillObject },
  scanDimTop:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  scanMiddleRow:     { flexDirection: 'row', height: 200 },
  scanDimSide:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  scanFrame:         { width: 260, height: 200, position: 'relative' },
  corner:            { position: 'absolute', width: 28, height: 28 },
  cornerTL:          { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderColor: '#fff', borderTopLeftRadius: 4 },
  cornerTR:          { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderColor: '#fff', borderTopRightRadius: 4 },
  cornerBL:          { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: '#fff', borderBottomLeftRadius: 4 },
  cornerBR:          { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderColor: '#fff', borderBottomRightRadius: 4 },
  scanDimBottom:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 60, gap: 20 },
  scanHint:          { color: 'rgba(255,255,255,0.7)', fontSize: TYPOGRAPHY.sm, textAlign: 'center' },
  scanCloseBtn:      { paddingHorizontal: 36, paddingVertical: 13, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: RADIUS.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  scanCloseBtnText:  { color: '#fff', fontSize: TYPOGRAPHY.sm, fontWeight: '700' },

  // ── Import modal
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
  importSubmitBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary },
  importSubmitText: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: '#fff' },
});
