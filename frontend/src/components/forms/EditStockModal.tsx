import React, { useState } from 'react';
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

export function EditStockModal({
  visible, item, onClose,
}: {
  visible: boolean; item: StockItem | null; onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [warehouseId, setWarehouseId] = useState(item?.warehouse ?? 'WH01');
  const [binRack,     setBinRack]     = useState('Rack A-07');
  const [batchSerial, setBatchSerial] = useState('SN2024-01');
  const [adjQty,      setAdjQty]      = useState(0);
  const [adjReasonId, setAdjReasonId] = useState('');
  const [refNote,     setRefNote]     = useState('');

  const reset = () => {
    setWarehouseId(item?.warehouse ?? 'WH01');
    setBinRack('Rack A-07');
    setBatchSerial('SN2024-01');
    setAdjQty(0);
    setAdjReasonId('');
    setRefNote('');
  };

  const validate = () => {
    if (adjQty === 0) {
      Toast.show({ type: 'error', text1: 'Required', text2: 'Adjustment quantity must be ≠ 0.' });
      return false;
    }
    if (!adjReasonId) {
      Toast.show({ type: 'error', text1: 'Required', text2: 'Select an adjustment reason.' });
      return false;
    }
    return true;
  };

  const handleDone = () => {
    Toast.show({ type: 'success', text1: 'Adjustment Saved', text2: `${item?.name} adjusted by ${adjQty} units.` });
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
            <Text style={ms.title}>Edit Stock</Text>
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

            {/* Warehouse dropdown */}
            <InlineDropdownField
              label="Warehouse"
              options={ALL_WAREHOUSES}
              value={warehouseId}
              onSelect={setWarehouseId}
              icon="home-outline"
            />

            {/* Bin/Rack + Batch/Serial (side-by-side) */}
            <View style={ms.row}>
              <InlineField
                label="Bin / Rack"
                value={binRack}
                onChange={setBinRack}
                placeholder="Rack A-07"
              />
              <InlineField
                label="Batch / Serial"
                value={batchSerial}
                onChange={setBatchSerial}
                placeholder="SN2024-01"
              />
            </View>

            {/* Current On-hand Qty (full-width, read-only) */}
            <ReadonlyField
              label="Current On-hand Qty"
              value={item ? String(item.qty) : '—'}
            />

            {/* Adjustment Quantity stepper (full-width) */}
            <QtyStepperField
              label="Adjustment Quantity"
              subLabel="(required)"
              value={adjQty}
              onChange={setAdjQty}
            />

            {/* Adjustment Reason dropdown (full-width) */}
            <InlineDropdownField
              label="Adjustment Reason"
              options={ADJ_REASONS}
              value={adjReasonId}
              onSelect={setAdjReasonId}
              placeholder="Select reason"
              required
            />

            {/* Reference / Note */}
            <InlineField
              label="Reference / Note"
              value={refNote}
              onChange={setRefNote}
              placeholder="—"
              multiline
            />
          </ScrollView>

          <View style={ms.footer}>
            <SubmitButton
              idleLabel="Save Adjustment"
              loadingLabel="Saving..."
              successLabel="✓ Adjustment Done"
              onValidate={validate}
              onDone={handleDone}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
