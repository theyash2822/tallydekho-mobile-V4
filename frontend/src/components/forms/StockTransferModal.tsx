import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal, ScrollView,
  KeyboardAvoidingView, Platform, Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { StockItem } from '../../data/stockData';
import { getWarehouses, getStockGodowns, createStockTransfer } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
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
  const { company } = useAuth();

  const [sourceWhName, setSourceWhName] = useState('');   // godown name (what Tally uses)
  const [destWhName,   setDestWhName]   = useState('');
  const [transferQty,  setTransferQty]  = useState(1);
  const [narration,    setNarration]    = useState('');

  // All warehouses in company (for destination)
  const [allWarehouses, setAllWarehouses] = useState<string[]>([]);
  // Warehouses where THIS item has stock (for source)
  const [itemGodowns,   setItemGodowns]   = useState<string[]>([]);
  const [isSubmitting,  setIsSubmitting]  = useState(false);

  useEffect(() => {
    if (!visible || !company?.guid || !item) return;

    // Fetch all company warehouses (for destination dropdown)
    getWarehouses(company.guid).then((res: any) => {
      const wh: string[] = Array.isArray(res?.data)
        ? res.data.map((w: any) => w.name).filter(Boolean)
        : [];
      setAllWarehouses(wh);
    }).catch(() => {});

    // Fetch godowns where this item has stock (for source dropdown)
    getStockGodowns(company.guid, item.id).then((res: any) => {
      const godowns: string[] = Array.isArray(res?.data) ? res.data : [];
      setItemGodowns(godowns);
      // Auto-select if only one source godown
      if (godowns.length === 1) {
        setSourceWhName(godowns[0]);
      } else if (godowns.length === 0) {
        // Fallback to item's warehouse field
        setSourceWhName(item.warehouse || '');
      } else {
        setSourceWhName('');
      }
    }).catch(() => {
      // Fallback: use item.warehouse
      setSourceWhName(item.warehouse || '');
    });

    setDestWhName('');
    setTransferQty(1);
    setNarration('');
  }, [visible, item?.id, company?.guid]);

  // Source options = godowns where stock exists
  const sourceOptions = itemGodowns.map(n => ({ id: n, label: n }));
  // Dest options = all warehouses except source
  const destOptions   = allWarehouses
    .filter(n => n !== sourceWhName)
    .map(n => ({ id: n, label: n }));

  const reset = () => {
    setSourceWhName(''); setDestWhName('');
    setTransferQty(1); setNarration('');
  };

  const validate = () => {
    if (!sourceWhName) {
      Toast.show({ type: 'error', text1: 'Required', text2: 'Select source warehouse.' });
      return false;
    }
    if (!destWhName) {
      Toast.show({ type: 'error', text1: 'Required', text2: 'Select destination warehouse.' });
      return false;
    }
    if (transferQty <= 0) {
      Toast.show({ type: 'error', text1: 'Required', text2: 'Quantity must be greater than 0.' });
      return false;
    }
    return true;
  };

  const handleDone = async () => {
    if (!company?.guid || !item) return;
    setIsSubmitting(true);
    try {
      const res: any = await createStockTransfer({
        companyGuid: company.guid,
        companyName: company.name || '',
        date:        new Date().toISOString().slice(0, 10),
        narration,
        fromGodown:  sourceWhName,
        toGodown:    destWhName,
        items: [{
          itemName: item.name,
          qty:      String(transferQty),
          rate:     String(+(item.value?.replace(/[^0-9.]/g, '') || 0)),
          amount:   String(transferQty * +(item.value?.replace(/[^0-9.]/g, '') || 0)),
        }],
      });
      Keyboard.dismiss();
      const queued = res?.queued;
      reset(); onClose();
      setTimeout(() => Toast.show({
        type: 'success',
        text1: queued ? 'Queued ⏳' : 'Transfer Created ✅',
        text2: queued
          ? 'Saved. Will push to Tally when desktop connects.'
          : `${transferQty} × ${item.name} → ${destWhName}`,
      }), 300);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Transfer Failed', text2: err?.message || 'Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => { if (!isSubmitting) { Keyboard.dismiss(); reset(); onClose(); } };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableOpacity style={ms.overlay} activeOpacity={1} onPress={handleClose} />
        <View style={[ms.sheet, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <View style={ms.handle} />

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
            {item ? <ItemHeaderCard item={item} /> : null}

            {/* Source Warehouse — auto-selected if only 1 godown */}
            {sourceOptions.length === 1 ? (
              <ReadonlyField
                label="Source Warehouse"
                value={sourceWhName}
              />
            ) : (
              <InlineDropdownField
                label="Source Warehouse"
                options={sourceOptions}
                value={sourceWhName}
                onSelect={(v) => { setSourceWhName(v); setDestWhName(''); }}
                icon="home-outline"
                placeholder="Select source warehouse"
                required
              />
            )}

            {/* On-hand Qty */}
            <ReadonlyField
              label="On-hand Qty"
              value={item ? String(item.qty) : '—'}
            />

            {/* Destination Warehouse */}
            <InlineDropdownField
              label="Destination Warehouse"
              options={destOptions}
              value={destWhName}
              onSelect={setDestWhName}
              placeholder="Select destination"
              icon="home-outline"
              required
            />

            {/* Qty to Transfer */}
            <QtyStepperField
              label="Qty to Transfer"
              subLabel="(required)"
              value={transferQty}
              onChange={setTransferQty}
            />

            {/* Narration */}
            <InlineField
              label="Narration"
              value={narration}
              onChange={setNarration}
              placeholder="Optional note"
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
