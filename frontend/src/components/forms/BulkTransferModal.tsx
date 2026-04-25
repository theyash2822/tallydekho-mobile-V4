import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal, ScrollView, TextInput,
  KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../constants/colors';
import { StockItem, STOCK_ITEMS, ALL_WAREHOUSES } from '../../data/stockData';
import {
  InlineDropdownField, InlineField, ReadonlyField,
  QtyStepperField, SubmitButton,
  modalStyles as ms,
} from './StockFormHelpers';

// ─── LOCAL TYPE ───────────────────────────────────────────────────────────────
type TransferRow = { item: StockItem; qty: number; batchSerial: string };

// ─── COMPONENT ───────────────────────────────────────────────────────────────
export function BulkTransferModal({
  visible, preselectedItems, onClose,
}: {
  visible: boolean; preselectedItems: StockItem[]; onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [rows,       setRows]       = useState<TransferRow[]>([]);
  const [search,     setSearch]     = useState('');
  const [sourceWh,   setSourceWh]   = useState('');
  const [sourceRack, setSourceRack] = useState('');
  const [destWhId,   setDestWhId]   = useState('');
  const [destRack,   setDestRack]   = useState('');
  const [narration,  setNarration]  = useState('');

  useEffect(() => {
    if (visible) {
      setRows(preselectedItems.map(i => ({ item: i, qty: 1, batchSerial: 'SN2024-01' })));
      setSearch(''); setSourceWh(''); setSourceRack('');
      setDestWhId(''); setDestRack(''); setNarration('');
    }
  }, [visible]);

  const searchResults = search.trim()
    ? STOCK_ITEMS
        .filter(i =>
          (i.name.toLowerCase().includes(search.toLowerCase()) ||
           i.sku.toLowerCase().includes(search.toLowerCase())) &&
          !rows.find(r => r.item.id === i.id)
        )
        .slice(0, 4)
    : [];

  const addItem    = (i: StockItem)       => { setRows(p => [...p, { item: i, qty: 1, batchSerial: '' }]); setSearch(''); };
  const removeItem = (id: string)         => setRows(p => p.filter(r => r.item.id !== id));
  const updQty     = (id: string, q: number) => setRows(p => p.map(r => r.item.id === id ? { ...r, qty: q } : r));
  const updBatch   = (id: string, b: string) => setRows(p => p.map(r => r.item.id === id ? { ...r, batchSerial: b } : r));

  const shownPills = rows.slice(0, 3);
  const extraCount = rows.length - 3;

  const validate = () => {
    if (rows.length === 0) {
      Toast.show({ type: 'error', text1: 'No Items', text2: 'Add at least one item to transfer.' });
      return false;
    }
    if (!destWhId) {
      Toast.show({ type: 'error', text1: 'Required', text2: 'Select destination warehouse.' });
      return false;
    }
    return true;
  };

  const handleDone = () => {
    const toLabel = ALL_WAREHOUSES.find(w => w.id === destWhId)?.label ?? destWhId;
    Toast.show({
      type: 'success',
      text1: 'Bulk Transfer Initiated',
      text2: `${rows.length} item${rows.length !== 1 ? 's' : ''} → ${toLabel}`,
    });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableOpacity style={ms.overlay} activeOpacity={1} onPress={onClose} />
        <View style={[ms.sheet, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <View style={ms.handle} />

          {/* Header */}
          <View style={ms.titleRow}>
            <Text style={ms.title}>Bulk Transfer</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={ms.scroll}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Item Name (SKU) section ─────────────────────── */}
            <View style={bt.pillSection}>
              <Text style={ms.sectionLbl}>Item Name (SKU)</Text>

              {/* Pills row */}
              <View style={bt.pillRow}>
                {shownPills.map(r => (
                  <View key={r.item.id} style={bt.pill}>
                    <Text style={bt.pillTxt} numberOfLines={1}>{r.item.name} ({r.item.sku})</Text>
                    <TouchableOpacity
                      onPress={() => removeItem(r.item.id)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="close" size={13} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ))}
                {extraCount > 0 ? (
                  <View style={bt.pillExtra}>
                    <Text style={bt.pillExtraTxt}>+{extraCount} more</Text>
                  </View>
                ) : null}
                {rows.length === 0 ? (
                  <Text style={bt.emptyPill}>No items selected — search below to add</Text>
                ) : null}
              </View>

              {/* Search to add items */}
              <View style={bt.searchWrap}>
                <Ionicons name="search-outline" size={14} color={COLORS.textTertiary} />
                <TextInput
                  style={bt.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search & add items..."
                  placeholderTextColor={COLORS.textTertiary}
                />
                {search.length > 0 ? (
                  <TouchableOpacity onPress={() => setSearch('')}>
                    <Ionicons name="close-circle" size={15} color={COLORS.textTertiary} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Search results */}
              {searchResults.length > 0 ? (
                <View style={bt.results}>
                  {searchResults.map((i, idx) => (
                    <TouchableOpacity
                      key={i.id}
                      style={[bt.resultItem, idx < searchResults.length - 1 && { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault }]}
                      onPress={() => addItem(i)}
                      activeOpacity={0.7}
                    >
                      <View style={bt.resultIcon}>
                        <Ionicons name="cube-outline" size={14} color={COLORS.textPrimary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={bt.resultName} numberOfLines={1}>{i.name}</Text>
                        <Text style={bt.resultSku}>{i.sku}</Text>
                      </View>
                      <Ionicons name="add-circle-outline" size={18} color={COLORS.brandPrimary} />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>

            {/* ── Source Location ──────────────────────────────── */}
            <InlineField
              label="Source Warehouse"
              value={sourceWh}
              onChange={setSourceWh}
              placeholder="Search warehouse..."
            />
            <InlineField
              label="Source Rack"
              value={sourceRack}
              onChange={setSourceRack}
              placeholder="Search rack..."
            />

            {/* ── Per-item transfer sections ───────────────────── */}
            {rows.length > 0 ? (
              <View>
                <View style={ms.divider} />
                <Text style={[ms.sectionLbl, { marginBottom: 10 }]}>Items to Transfer</Text>
                {rows.map(r => (
                  <View key={r.item.id} style={bt.itemCard}>
                    {/* Item card header */}
                    <View style={bt.itemHeader}>
                      <View style={bt.itemIcon}>
                        <Ionicons name="cube-outline" size={16} color={COLORS.textPrimary} />
                      </View>
                      <Text style={bt.itemName} numberOfLines={1}>{r.item.name}</Text>
                      <TouchableOpacity
                        onPress={() => removeItem(r.item.id)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        style={{ padding: 2 }}
                      >
                        <Ionicons name="close" size={16} color={COLORS.textTertiary} />
                      </TouchableOpacity>
                    </View>

                    {/* On-hand Qty + Batch/Serial (side-by-side) */}
                    <View style={ms.row}>
                      <ReadonlyField label="On-hand Qty" value={String(r.item.qty)} />
                      <InlineField
                        label="Batch / Serial"
                        value={r.batchSerial}
                        onChange={v => updBatch(r.item.id, v)}
                        placeholder="SN2024-01"
                      />
                    </View>

                    {/* Qty to Transfer stepper (full width) */}
                    <QtyStepperField
                      label="Quantity to Transfer"
                      subLabel="(required)"
                      value={r.qty}
                      onChange={q => updQty(r.item.id, q)}
                    />
                  </View>
                ))}
                <View style={ms.divider} />
              </View>
            ) : null}

            {/* ── Destination Location ─────────────────────────── */}
            <InlineDropdownField
              label="Destination Warehouse"
              options={ALL_WAREHOUSES}
              value={destWhId}
              onSelect={setDestWhId}
              placeholder="Select warehouse"
              icon="home-outline"
              required
            />
            <InlineField
              label="Destination Rack"
              value={destRack}
              onChange={setDestRack}
              placeholder="Search rack..."
            />
            <InlineField
              label="Narration"
              value={narration}
              onChange={setNarration}
              placeholder="—"
              multiline
            />
          </ScrollView>

          <View style={ms.footer}>
            <SubmitButton
              idleLabel="Transfer All"
              loadingLabel="Transferring..."
              successLabel="✓ Transferred"
              onValidate={validate}
              onDone={handleDone}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const bt = StyleSheet.create({
  pillSection:  { marginBottom: SPACING.md },
  pillRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  pill:         { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#E8E7E1', borderRadius: RADIUS.full, maxWidth: 200 },
  pillTxt:      { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textPrimary, flex: 1 },
  pillExtra:    { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.full },
  pillExtraTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.white },
  emptyPill:    { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontStyle: 'italic' },
  searchWrap:   { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: COLORS.borderDefault },
  searchInput:  { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, padding: 0 },
  results:      { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, marginTop: 6, overflow: 'hidden' },
  resultItem:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  resultIcon:   { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8E7E1' },
  resultName:   { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  resultSku:    { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  itemCard:     { backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: 10, borderWidth: 1, borderColor: COLORS.borderDefault },
  itemHeader:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  itemIcon:     { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8E7E1' },
  itemName:     { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
});
