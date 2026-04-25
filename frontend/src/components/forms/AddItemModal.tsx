import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING } from '../../constants/colors';
import { ALL_GROUPS, ALL_UNITS, ALL_TAX_RATES, ALL_WAREHOUSES } from '../../data/stockData';
import {
  InlineDropdownField, InlineField, CurrencyField, SubmitButton,
  modalStyles as ms,
} from './StockFormHelpers';

export function AddItemModal({
  visible, onClose,
}: {
  visible: boolean; onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [group,         setGroup]         = useState('');
  const [name,          setName]          = useState('');
  const [unit,          setUnit]          = useState('');
  const [taxRate,       setTaxRate]       = useState('');
  const [purchPrice,    setPurchPrice]    = useState('');
  const [warehouse,     setWarehouse]     = useState('WH01');
  const [qty,           setQty]           = useState('');
  const [salePrice,     setSalePrice]     = useState('');
  const [expiryDate,    setExpiryDate]    = useState('');
  const [batchNo,       setBatchNo]       = useState('');
  const [genBarcode,    setGenBarcode]    = useState(true);
  const [barcodeFields, setBarcodeFields] = useState({
    itemName: true, sku: false, salePrice: false,
  });

  const reset = () => {
    setGroup(''); setName(''); setUnit(''); setTaxRate(''); setPurchPrice('');
    setWarehouse('WH01'); setQty(''); setSalePrice(''); setExpiryDate('');
    setBatchNo(''); setGenBarcode(true);
    setBarcodeFields({ itemName: true, sku: false, salePrice: false });
  };

  const validate = () => {
    if (!name.trim()) {
      Toast.show({ type: 'error', text1: 'Required', text2: 'Product name is required.' });
      return false;
    }
    if (!unit) {
      Toast.show({ type: 'error', text1: 'Required', text2: 'Select a unit of measure.' });
      return false;
    }
    return true;
  };

  const handleDone = () => {
    Toast.show({ type: 'success', text1: 'Item Saved', text2: `"${name}" added to inventory.` });
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
            <Text style={ms.title}>Add New Item</Text>
            <TouchableOpacity onPress={handleClose} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={ms.scroll}
            keyboardShouldPersistTaps="handled"
          >
            {/* Group dropdown */}
            <InlineDropdownField
              label="Group"
              options={ALL_GROUPS.map(g => ({ id: g, label: g }))}
              value={group}
              onSelect={setGroup}
              placeholder="Select group"
            />

            {/* Product name (required) */}
            <InlineField
              label="Product name"
              value={name}
              onChange={setName}
              placeholder="Enter product name"
              required
            />

            {/* Unit of Measure + Tax Rate (side-by-side) */}
            <View style={ms.row}>
              <InlineDropdownField
                label="Unit of measure *"
                options={ALL_UNITS}
                value={unit}
                onSelect={setUnit}
                placeholder="Select UOM"
                required
              />
              <InlineDropdownField
                label="Tax rate"
                options={ALL_TAX_RATES}
                value={taxRate}
                onSelect={setTaxRate}
                placeholder="None"
              />
            </View>

            {/* Purchase Price */}
            <CurrencyField
              label="Purchase Price"
              value={purchPrice}
              onChange={setPurchPrice}
              placeholder="₹ 0.00"
            />

            {/* Warehouse Placement */}
            <InlineDropdownField
              label="Warehouse Placement"
              options={ALL_WAREHOUSES}
              value={warehouse}
              onSelect={setWarehouse}
              placeholder="Select warehouse"
              icon="home-outline"
            />

            {/* Quantity + Sale Price (side-by-side) */}
            <View style={ms.row}>
              <InlineField
                label="Opening Qty"
                value={qty}
                onChange={setQty}
                placeholder="0"
                keyboardType="numeric"
              />
              <CurrencyField
                label="Sale Price"
                value={salePrice}
                onChange={setSalePrice}
                placeholder="₹ 0.00"
              />
            </View>

            {/* Expiry Date + Batch Number (side-by-side) */}
            <View style={ms.row}>
              <InlineField
                label="Expiry Date"
                value={expiryDate}
                onChange={setExpiryDate}
                placeholder="DD/MM/YYYY"
              />
              <InlineField
                label="Batch Number"
                value={batchNo}
                onChange={setBatchNo}
                placeholder="Enter batch no."
              />
            </View>

            {/* Generate Barcode toggle */}
            <View style={ai.switchRow}>
              <Switch
                value={genBarcode}
                onValueChange={setGenBarcode}
                trackColor={{ false: COLORS.borderDefault, true: COLORS.brandPrimary }}
                thumbColor={COLORS.white}
              />
              <Text style={ai.switchTxt}>Generate Barcode</Text>
            </View>

            {/* Barcode field checkboxes */}
            {genBarcode ? (
              <View style={ai.checkRow}>
                {(['itemName', 'sku', 'salePrice'] as const).map(k => {
                  const labelMap = { itemName: 'Item Name', sku: 'SKU', salePrice: 'Sale Price' } as const;
                  return (
                    <TouchableOpacity
                      key={k}
                      style={ai.checkItem}
                      onPress={() => setBarcodeFields(p => ({ ...p, [k]: !p[k] }))}
                      activeOpacity={0.7}
                    >
                      <View style={[ai.checkbox, barcodeFields[k] && ai.checkboxActive]}>
                        {barcodeFields[k] ? <Ionicons name="checkmark" size={12} color={COLORS.white} /> : null}
                      </View>
                      <Text style={ai.checkTxt}>{labelMap[k]}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}
          </ScrollView>

          <View style={ms.footer}>
            <SubmitButton
              idleLabel="Save Item"
              loadingLabel="Saving..."
              successLabel="✓ Saved"
              onValidate={validate}
              onDone={handleDone}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const ai = StyleSheet.create({
  switchRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: SPACING.md },
  switchTxt:      { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textPrimary },
  checkRow:       { flexDirection: 'row', gap: 16, marginBottom: SPACING.md, flexWrap: 'wrap' },
  checkItem:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkbox:       { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: COLORS.borderStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.cardBg },
  checkboxActive: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  checkTxt:       { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
});
