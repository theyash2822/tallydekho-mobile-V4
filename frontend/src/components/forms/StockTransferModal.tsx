import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { StockItem, STOCK_ITEMS, ALL_WAREHOUSES, ALL_CATEGORIES, ALL_GROUPS, ALL_UNITS, ALL_TAX_RATES, RACK_OPTIONS, ADJ_REASONS, LOW_STOCK_QTY } from '../../data/stockData';
import { COLORS } from '../../constants/colors';

import {
  InlineDropdownField, InlineField, ReadonlyField,
  QtyStepperField, ItemHeaderCard, SubmitButton,
  modalStyles as ms,
} from './StockFormHelpers';

export function StockTransferModal({
  visible, item, onClose,
}: {
  visible: boolean; item: StockItem | null; onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [sourceWhId,   setSourceWhId]   = useState('');
  const [sourceRackId, setSourceRackId] = useState('');
  const [batchSerial,  setBatchSerial]  = useState('SN2024-01');
  const [destWhId,     setDestWhId]     = useState('');
  const [destRack,     setDestRack]     = useState('');
  const [transferQty,  setTransferQty]  = useState(1);
  const [narration,    setNarration]    = useState('');

  useEffect(() => {
    if (visible && item) setSourceWhId(item.warehouse);
  }, [visible, item?.id]);

  const destOptions = ALL_WAREHOUSES.filter(w => w.id !== sourceWhId);

  const reset = () => {
    setSourceRackId(''); setBatchSerial('SN2024-01');
    setDestWhId(''); setDestRack(''); setTransferQty(1); setNarration('');
  };

  const validate = () => {
    if (!destWhId) {
      Toast.show({ type: 'error', text1: 'Required', text2: 'Select destination warehouse.' });
      return false;
    }
    if (transferQty === 0) {
      Toast.show({ type: 'error', text1: 'Required', text2: 'Quantity to transfer must be ≠ 0.' });
      return false;
    }
    return true;
  };

  const handleDone = () => {
    const toLabel = ALL_WAREHOUSES.find(w => w.id === destWhId)?.label ?? destWhId;
    Toast.show({
      type: 'success',
      text1: 'Transfer Initiated',
      text2: `${transferQty} units of ${item?.name} → ${toLabel}`,
    });
    reset(); onClose();
  };

  const handleClose = () => { reset(); onClose(); };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableOpacity style={ms.overlay} activeOpacity={1} onPress={handleClose} />
        <View style={[ms.sheet, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <View style={ms.handle} />

          {/* Header */}
          <View style={ms.titleRow}>
            <Text style={ms.title}>Stock Transfer</Text>
            <TouchableOpacity onPress={handleClose} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={ms.scroll}
            keyboardShouldPersistTaps="handled"
          >
            {/* Item header card */}
            {item ? <ItemHeaderCard item={item} /> : null}

            {/* Source Warehouse */}
            <InlineDropdownField
              label="Source Warehouse"
              options={ALL_WAREHOUSES}
              value={sourceWhId}
              onSelect={(v) => { setSourceWhId(v); setDestWhId(''); }}
              icon="home-outline"
            />

            {/* Source Rack */}
            <InlineDropdownField
              label="Source Rack"
              options={RACK_OPTIONS}
              value={sourceRackId}
              onSelect={setSourceRackId}
              placeholder="Select rack"
            />

            {/* On-hand Qty + Batch/Serial (side-by-side) */}
            <View style={ms.row}>
              <ReadonlyField
                label="On-hand Qty"
                value={item ? String(item.qty) : '—'}
              />
              <InlineField
                label="Batch / Serial"
                value={batchSerial}
                onChange={setBatchSerial}
                placeholder="SN2024-01"
              />
            </View>

            {/* Destination Warehouse (required) */}
            <InlineDropdownField
              label="Destination Warehouse"
              options={destOptions}
              value={destWhId}
              onSelect={setDestWhId}
              placeholder="Select warehouse"
              icon="home-outline"
              required
            />

            {/* Destination Rack + Qty to Transfer (side-by-side) */}
            <View style={ms.row}>
              <InlineField
                label="Destination Rack"
                value={destRack}
                onChange={setDestRack}
                placeholder="Rack A-07"
              />
              <QtyStepperField
                label="Qty to Transfer"
                subLabel="(required)"
                value={transferQty}
                onChange={setTransferQty}
              />
            </View>

            {/* Narration */}
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
              idleLabel="Transfer"
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
