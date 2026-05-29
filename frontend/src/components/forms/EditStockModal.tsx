import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal, ScrollView,
  KeyboardAvoidingView, Platform, Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { StockItem, ALL_TAX_RATES } from '../../data/stockData';
import { alterStockItem, getStockGroups } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/colors';

import {
  InlineDropdownField, InlineField, ReadonlyField,
  ItemHeaderCard, SubmitButton,
  modalStyles as ms,
} from './StockFormHelpers';

// EditStockModal — Stock Master Alteration (NOT a voucher)
// Edits item metadata: HSN, reorder level, GST rate, notes
// Per architecture: uses STOCKITEM ACTION="Alter" XML, not Physical Stock voucher
export function EditStockModal({
  visible, item, onClose,
}: {
  visible: boolean; item: StockItem | null; onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { company } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Editable master fields
  const [hsnCode,      setHsnCode]      = useState('');
  const [reorderLevel, setReorderLevel] = useState('');
  const [taxRateId,    setTaxRateId]    = useState('');
  const [groupName,    setGroupName]    = useState('');
  const [groupOptions, setGroupOptions] = useState<{id: string; label: string}[]>([]);
  const [notes,        setNotes]        = useState('');

  useEffect(() => {
    if (visible && item) {
      setHsnCode(item.sku || '');
      setReorderLevel(String(item.reorderLevel ?? ''));
      setTaxRateId('');
      setGroupName(item.group || '');  // pre-fill current group
      setNotes('');
    }
  }, [visible, item?.id]);

  useEffect(() => {
    if (visible && company?.guid && groupOptions.length === 0) {
      getStockGroups(company.guid)
        .then((res: any) => {
          const groups = (res?.data || []).map((g: string) => ({ id: g, label: g }));
          setGroupOptions(groups);
        })
        .catch(() => {});
    }
  }, [visible, company?.guid]);

  const reset = () => {
    setHsnCode(''); setReorderLevel(''); setTaxRateId(''); setGroupName(''); setNotes('');
  };

  const validate = () => {
    if (!hsnCode && !reorderLevel && !taxRateId && !groupName) {
      Toast.show({ type: 'error', text1: 'Nothing to update', text2: 'Change at least one field.' });
      return false;
    }
    return true;
  };

  const handleDone = async () => {
    if (!company?.guid || !item) return;
    setIsSubmitting(true);
    try {
      const changes: Record<string, any> = {};
      if (hsnCode      && hsnCode !== item.sku)                     changes.hsnCode      = hsnCode;
      if (reorderLevel && reorderLevel !== String(item.reorderLevel)) changes.reorderLevel = parseFloat(reorderLevel);
      if (taxRateId)                                                  changes.taxRate      = parseFloat(taxRateId);
      if (groupName && groupName !== (item.group || ''))              changes.groupName    = groupName;

      if (Object.keys(changes).length === 0) {
        Toast.show({ type: 'info', text1: 'No changes', text2: 'Values are the same as current.' });
        setIsSubmitting(false);
        return;
      }

      const res: any = await alterStockItem({
        companyGuid:  company.guid,
        companyName:  company.name || '',
        existingName: item.name,
        changes,
      });

      Keyboard.dismiss();
      reset(); onClose();
      const queued = res?.queued;
      setTimeout(() => Toast.show({
        type: 'success',
        text1: queued ? 'Update Queued ⏳' : 'Item Updated ✅',
        text2: queued
          ? 'Saved. Will update in Tally when desktop connects.'
          : `${item.name} updated in Tally`,
      }), 300);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Update Failed', text2: err?.message || 'Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => { Keyboard.dismiss(); reset(); onClose(); };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableOpacity style={ms.overlay} activeOpacity={1} onPress={handleClose} />
        <View style={[ms.sheet, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <View style={ms.handle} />

          <View style={ms.titleRow}>
            <Text style={ms.title}>Edit Stock Item</Text>
            <TouchableOpacity onPress={handleClose} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={ms.scroll}
            keyboardShouldPersistTaps="handled"
          >
            {item ? <ItemHeaderCard item={item} /> : null}

            {/* Read-only current values */}
            <ReadonlyField label="Item Name"       value={item?.name || '—'} />
            <ReadonlyField label="Current Qty"     value={item ? String(item.qty) : '—'} />

            {/* Editable master fields */}
            <InlineField
              label="HSN Code"
              value={hsnCode}
              onChange={setHsnCode}
              placeholder="e.g. 38089190"
            />

            <InlineField
              label="Reorder Level"
              value={reorderLevel}
              onChange={setReorderLevel}
              placeholder="e.g. 50"
            />

            <InlineDropdownField
              label="GST Rate"
              options={ALL_TAX_RATES}
              value={taxRateId}
              onSelect={setTaxRateId}
              placeholder="Select GST rate"
            />

            <InlineDropdownField
              label="Stock Group"
              options={groupOptions}
              value={groupName}
              onSelect={setGroupName}
              placeholder={groupOptions.length > 0 ? 'Select group' : 'Loading groups...'}
            />

            <InlineField
              label="Notes / Reference"
              value={notes}
              onChange={setNotes}
              placeholder="Optional"
              multiline
            />
          </ScrollView>

          <View style={ms.footer}>
            <SubmitButton
              idleLabel="Update in Tally"
              loadingLabel="Updating..."
              successLabel="✓ Updated"
              onValidate={validate}
              onDone={handleDone}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
