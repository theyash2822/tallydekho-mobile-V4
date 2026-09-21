import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { StockItem } from '../../data/stockData';
import { getWarehouses, createStockTransfer } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { todayLocalISO } from '../../utils/periodDates';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../constants/colors';
import { clearStockListCache } from '../../utils/stockCache';
import { useRbasCreate } from '../../hooks/useRbasCreate';

import {
  InlineDropdownField, InlineField,
  QtyStepperField, SubmitButton,
  modalStyles as ms,
} from './StockFormHelpers';
import { BottomModalShell } from './BottomModalShell';

type TransferRow = { item: StockItem; qty: number };

export function BulkTransferModal({
  visible, preselectedItems, onClose,
}: {
  visible: boolean; preselectedItems: StockItem[]; onClose: () => void;
}) {
  const { company } = useAuth();
  const { scopeGodowns, assertCanCreate } = useRbasCreate();
  const scrollRef = useRef<ScrollView>(null);

  const [rows,             setRows]             = useState<TransferRow[]>([]);
  const [search,           setSearch]           = useState('');
  const [destWhId,         setDestWhId]         = useState('');
  const [narration,        setNarration]        = useState('');
  const [warehouseOptions, setWarehouseOptions] = useState<{id:string;label:string}[]>([]);

  const scrollNoteIntoView = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd?.({ animated: true });
    }, 250);
  }, []);

  useEffect(() => {
    if (visible) {
      setRows(preselectedItems.map(i => ({ item: i, qty: 1 })));
      setSearch(''); setDestWhId(''); setNarration('');
      if (company?.guid) {
        getWarehouses(company.guid)
          .then((res: any) => {
            const wh = scopeGodowns(res?.data ?? (Array.isArray(res) ? res : []));
            setWarehouseOptions(wh.map((w: any) => ({ id: w.name, label: w.name })));
          })
          .catch(() => {});
      }
    }
  }, [visible, preselectedItems, company?.guid, scopeGodowns]);

  const filteredRows = search.trim()
    ? rows.filter(r =>
        r.item.name.toLowerCase().includes(search.toLowerCase()) ||
        r.item.sku.toLowerCase().includes(search.toLowerCase())
      )
    : rows;

  const removeItem = (id: string) => setRows(p => p.filter(r => r.item.id !== id));
  const updQty     = (id: string, q: number) => setRows(p => p.map(r => r.item.id === id ? { ...r, qty: q } : r));

  const validate = () => {
    if (!assertCanCreate('stock_transfer.create')) return false;
    if (rows.length === 0) {
      Toast.show({ type: 'error', text1: 'No Items', text2: 'No items selected for transfer.' });
      return false;
    }
    if (!destWhId) {
      Toast.show({ type: 'error', text1: 'Required', text2: 'Select destination warehouse.' });
      return false;
    }
    return true;
  };

  const handleDone = async () => {
    if (!company?.guid) return;
    const toLabel = destWhId;
    const itemsList = rows.map(r => ({
      itemName: r.item.name,
      qty:      String(r.qty),
      rate:     String(+(r.item.value?.replace(/[^0-9.]/g, '') || 0)),
      amount:   String(r.qty * +(r.item.value?.replace(/[^0-9.]/g, '') || 0)),
    }));
    onClose();
    try {
      const res: any = await createStockTransfer({
        companyGuid: company.guid,
        companyName: company.name || '',
        date:        todayLocalISO(),
        narration:   narration || `Bulk transfer → ${toLabel}`,
        fromGodown:  preselectedItems[0]?.warehouse || 'Main Location',
        toGodown:    toLabel,
        items:       itemsList,
      });
      const queued = res?.queued;
      clearStockListCache();
      Toast.show({
        type: 'success',
        text1: queued ? 'Transfer Queued ⏳' : 'Transfer Created ✅',
        text2: queued
          ? 'Will push to Tally when desktop connects.'
          : `${rows.length} item${rows.length !== 1 ? 's' : ''} → ${toLabel}`,
      });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Transfer Failed', text2: err?.message || 'Please try again.' });
    }
  };

  const handleClose = () => { if (onClose) onClose(); };

  return (
    <BottomModalShell
      visible={visible}
      onClose={handleClose}
      keyboardAvoiding={false}
      scrollRef={scrollRef}
      scrollContentStyle={{ paddingBottom: 56 }}
      scrollProps={{
        keyboardDismissMode: 'interactive',
        automaticallyAdjustKeyboardInsets: true,
      }}
      titleNode={(
        <View>
          <Text style={ms.title}>Bulk Transfer</Text>
          <Text style={bt.subtitle}>{rows.length} item{rows.length !== 1 ? 's' : ''} selected</Text>
        </View>
      )}
      headerExtra={(
        <View style={bt.searchWrap}>
          <Ionicons name="search-outline" size={15} color={COLORS.textTertiary} />
          <TextInput
            style={bt.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder={`Search ${rows.length} selected items...`}
            placeholderTextColor={COLORS.textTertiary}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={15} color={COLORS.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      )}
      footer={(
        <SubmitButton
          idleLabel={`Transfer ${rows.length} Item${rows.length !== 1 ? 's' : ''}`}
          loadingLabel="Transferring..."
          successLabel="✓ Transferred"
          onValidate={validate}
          onDone={handleDone}
        />
      )}
    >
      {filteredRows.map(r => (
        <View key={r.item.id} style={bt.itemCard}>
          <View style={bt.itemHeader}>
            <View style={{ flex: 1, justifyContent: 'flex-end' }}>
              <Text style={bt.itemName} numberOfLines={1}>{r.item.name}</Text>
              <Text style={bt.itemSku}>{r.item.sku} · {r.item.qty} {r.item.unit || 'units'} on hand</Text>
            </View>
            <TouchableOpacity
              onPress={() => removeItem(r.item.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={16} color={COLORS.negative} />
            </TouchableOpacity>
          </View>
          <QtyStepperField
            label="Qty to Transfer"
            value={r.qty}
            onChange={q => updQty(r.item.id, q)}
          />
        </View>
      ))}

      {filteredRows.length === 0 && search.trim() && (
        <Text style={bt.emptyTxt}>No items match "{search}"</Text>
      )}

      <View style={ms.divider} />

      <InlineDropdownField
        label="Destination Warehouse"
        options={warehouseOptions}
        value={destWhId}
        placeholder={warehouseOptions.length > 0 ? 'Select destination' : 'Loading...'}
        onSelect={setDestWhId}
        icon="home-outline"
        required
      />
      <InlineField
        label="Narration"
        value={narration}
        onChange={setNarration}
        placeholder="Optional note"
        multiline
        onFocus={scrollNoteIntoView}
      />
    </BottomModalShell>
  );
}

const bt = StyleSheet.create({
  subtitle:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 8, marginHorizontal: SPACING.md, marginBottom: 4, borderWidth: 1, borderColor: COLORS.borderDefault },
  searchInput:{ flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, padding: 0 },
  itemCard:   { backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: 10, borderWidth: 1, borderColor: COLORS.borderDefault },
  itemHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  itemName:   { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  itemSku:    { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },
  emptyTxt:   { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary, textAlign: 'center', paddingVertical: 16 },
});
