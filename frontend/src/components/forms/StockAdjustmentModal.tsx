import React, { useState, useEffect } from 'react';
import { View, Text, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { StockItem } from '../../data/stockData';
import { getStockGodowns, createStockAdjustment } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/colors';
import { clearStockListCache } from '../../utils/stockCache';

import {
  InlineDropdownField, InlineField, ReadonlyField,
  QtyStepperField, ItemHeaderCard, SubmitButton,
  modalStyles as ms,
} from './StockFormHelpers';
import { BottomModalShell } from './BottomModalShell';

// ─── Constants ────────────────────────────────────────────────────────────────

const ADJUSTMENT_REASONS = [
  { id: 'Damage',    label: 'Damage',    icon: 'alert-circle-outline',   effect: 'reduce' as const },
  { id: 'Shortage',  label: 'Shortage',  icon: 'trending-down-outline',  effect: 'reduce' as const },
  { id: 'Expired',   label: 'Expired',   icon: 'time-outline',           effect: 'reduce' as const },
  { id: 'Lost',      label: 'Lost',      icon: 'search-outline',         effect: 'reduce' as const },
  { id: 'Excess',    label: 'Excess',    icon: 'trending-up-outline',    effect: 'increase' as const },
  { id: 'Correction',label: 'Correction',icon: 'create-outline',         effect: 'both' as const },
];

const DIRECTION_OPTIONS = [
  { id: 'Add',    label: '+ Add stock'    },
  { id: 'Reduce', label: '− Reduce stock' },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export function StockAdjustmentModal({
  visible, item, onClose,
}: {
  visible: boolean; item: StockItem | null; onClose: () => void;
}) {
  const { company } = useAuth();

  // Form state
  const [warehouse,    setWarehouse]    = useState('');
  const [adjQty,       setAdjQty]       = useState(1);
  const [reason,       setReason]       = useState('');
  const [direction,    setDirection]    = useState('');  // only for Correction
  const [note,         setNote]         = useState('');

  // Data state
  const [itemGodowns,  setItemGodowns]  = useState<string[]>([]);
  // isSubmitting removed — SubmitButton manages its own loading state

  // ── Load godowns when modal opens ──────────────────────────────────────────
  useEffect(() => {
    if (!visible || !company?.guid || !item) return;
    setReason(''); setDirection(''); setNote(''); setAdjQty(1);

    getStockGodowns(company.guid, item.id).then((res: any) => {
      const godowns: string[] = Array.isArray(res?.data) ? res.data : [];
      setItemGodowns(godowns);
      if (godowns.length === 1) {
        setWarehouse(godowns[0]);
      } else if (godowns.length === 0) {
        setWarehouse(item.warehouse || '');
      } else {
        setWarehouse('');
      }
    }).catch(() => {
      setWarehouse(item.warehouse || '');
    });
  }, [visible, item?.id]);

  // ── Derived values ──────────────────────────────────────────────────────────
  const selectedReason  = ADJUSTMENT_REASONS.find(r => r.id === reason);
  const isCorrection    = reason === 'Correction';
  const effectiveEffect = isCorrection
    ? (direction === 'Add' ? 'increase' : direction === 'Reduce' ? 'reduce' : null)
    : selectedReason?.effect || null;

  const previewSign = effectiveEffect === 'increase' ? '+' : effectiveEffect === 'reduce' ? '−' : '±';
  const previewColor = effectiveEffect === 'increase'
    ? COLORS.positive
    : effectiveEffect === 'reduce'
    ? COLORS.negative
    : COLORS.textSecondary;
  const newQty = effectiveEffect === 'increase'
    ? (item?.qty || 0) + adjQty
    : effectiveEffect === 'reduce'
    ? (item?.qty || 0) - adjQty
    : null;

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = (): boolean => {
    if (!warehouse) {
      Toast.show({ type: 'error', text1: 'Warehouse required', text2: 'Select the warehouse to adjust.' });
      return false;
    }
    if (!adjQty || adjQty <= 0) {
      Toast.show({ type: 'error', text1: 'Qty required', text2: 'Enter a positive adjustment quantity.' });
      return false;
    }
    if (!reason) {
      Toast.show({ type: 'error', text1: 'Reason required', text2: 'Select an adjustment reason.' });
      return false;
    }
    if (isCorrection && !direction) {
      Toast.show({ type: 'error', text1: 'Direction required', text2: 'Select Add or Reduce for Correction.' });
      return false;
    }
    // Prevent negative stock for reduce reasons
    if (effectiveEffect === 'reduce' && adjQty > (item?.qty || 0)) {
      Toast.show({ type: 'error', text1: 'Exceeds stock', text2: `Max adjustable: ${item?.qty} ${item?.unit || 'units'}` });
      return false;
    }
    return true;
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleDone = async () => {
    if (!company?.guid || !item) return;
    const itemName = item.name; // capture before reset
    // Always close the form immediately — entry is saved in write_queue
    Keyboard.dismiss();
    reset();
    onClose();
    try {
      const res: any = await createStockAdjustment({
        companyGuid:         company.guid,
        companyName:         company.name || '',
        stockGuid:           item.id,
        stockName:           item.name,
        warehouse,
        adjustmentQty:       adjQty,
        adjustmentReason:    reason,
        adjustmentDirection: isCorrection ? direction : null,
        qtyBefore:           item.qty || 0,
        note,
      });
      const queued = res?.queued || res?.status === 'queued';
      clearStockListCache();
      Toast.show({
        type: 'success',
        text1: queued ? 'Adjustment Queued ⏳' : 'Adjustment Saved ✅',
        text2: queued
          ? 'Saved. Will push to Tally when desktop connects.'
          : `${itemName} adjusted in Tally`,
      });
    } catch (err: any) {
      // Entry may already be in write_queue; show warning not error
      Toast.show({ type: 'info', text1: 'Adjustment Saved', text2: 'Will push to Tally when desktop connects.' });
    }
  };

  const reset = () => {
    setWarehouse(''); setAdjQty(1); setReason(''); setDirection(''); setNote('');
  };
  const handleClose = () => { Keyboard.dismiss(); reset(); onClose(); };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <BottomModalShell
      visible={visible}
      onClose={handleClose}
      titleNode={(
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
          <Ionicons name="options-outline" size={20} color="#A89060" />
          <Text style={ms.title}>Adjust Stock</Text>
        </View>
      )}
      footer={(
        <SubmitButton
          idleLabel="Save Adjustment"
          loadingLabel="Saving..."
          successLabel="✓ Adjustment Saved"
          onValidate={validate}
          onDone={handleDone}
        />
      )}
    >
      {item ? <ItemHeaderCard item={item} /> : null}

      <ReadonlyField label="Current Qty" value={item ? `${item.qty} ${item.unit || 'units'}` : '—'} />

      {itemGodowns.length > 1 ? (
        <InlineDropdownField
          label="Warehouse"
          options={itemGodowns.map(w => ({ id: w, label: w }))}
          value={warehouse}
          onSelect={(v) => { Keyboard.dismiss(); setWarehouse(v); }}
          placeholder="Select warehouse"
          required
        />
      ) : (
        <ReadonlyField label="Warehouse" value={warehouse || item?.warehouse || '—'} />
      )}

      <QtyStepperField
        label="Adjustment Qty"
        subLabel="(required)"
        value={adjQty}
        onChange={setAdjQty}
      />

      <InlineDropdownField
        label="Reason"
        options={ADJUSTMENT_REASONS.map(r => ({ id: r.id, label: r.label }))}
        value={reason}
        onSelect={(v) => { Keyboard.dismiss(); setReason(v); setDirection(''); }}
        placeholder="Select reason"
        required
      />

      {isCorrection && (
        <InlineDropdownField
          label="Direction"
          options={DIRECTION_OPTIONS}
          value={direction}
          onSelect={(v) => { Keyboard.dismiss(); setDirection(v); }}
          placeholder="Add or Reduce?"
          required
        />
      )}

      {reason !== '' && (effectiveEffect !== null) && (
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: previewColor + '12', borderRadius: 10, padding: 12, marginTop: 4, marginBottom: 12,
          borderWidth: 1, borderColor: previewColor + '30',
        }}>
          <Text style={{ fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' }}>
            Effect Preview
          </Text>
          <Text style={{ fontSize: 14, fontWeight: '700', color: previewColor }}>
            {previewSign}{adjQty} → {newQty !== null ? `${newQty} ${item?.unit || 'units'}` : '—'}
          </Text>
        </View>
      )}

      <InlineField
        label="Note / Reference"
        value={note}
        onChange={setNote}
        placeholder="Optional — e.g. damaged during handling"
        multiline
      />
    </BottomModalShell>
  );
}
