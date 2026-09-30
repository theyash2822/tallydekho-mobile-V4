import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  { id: 'Damage',    labelKey: 'screens.componentsFormsStockAdjustmentModal.damage',    icon: 'alert-circle-outline',   effect: 'reduce' as const },
  { id: 'Shortage',  labelKey: 'screens.componentsFormsStockAdjustmentModal.shortage',  icon: 'trending-down-outline',  effect: 'reduce' as const },
  { id: 'Expired',   labelKey: 'screens.componentsFormsStockAdjustmentModal.expired',   icon: 'time-outline',           effect: 'reduce' as const },
  { id: 'Lost',      labelKey: 'screens.componentsFormsStockAdjustmentModal.lost',      icon: 'search-outline',         effect: 'reduce' as const },
  { id: 'Excess',    labelKey: 'screens.componentsFormsStockAdjustmentModal.excess',    icon: 'trending-up-outline',    effect: 'increase' as const },
  { id: 'Correction',labelKey: 'screens.componentsFormsStockAdjustmentModal.correction',icon: 'create-outline',         effect: 'both' as const },
];

const DIRECTION_OPTIONS = [
  { id: 'Add',    labelKey: 'screens.componentsFormsStockAdjustmentModal.addStock'    },
  { id: 'Reduce', labelKey: 'screens.componentsFormsStockAdjustmentModal.reduceStock' },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export function StockAdjustmentModal({
  visible, item, onClose,
}: {
  visible: boolean; item: StockItem | null; onClose: () => void;
}) {
  const { company } = useAuth();
  const { t } = useTranslation();

  // Form state
  const [warehouse,    setWarehouse]    = useState('');
  const [adjQty,       setAdjQty]       = useState(1);
  const [reason,       setReason]       = useState('');
  const [direction,    setDirection]    = useState('');  // only for Correction
  const [note,         setNote]         = useState('');

  // Data state
  const [itemGodowns,  setItemGodowns]  = useState<string[]>([]);
  // isSubmitting removed — SubmitButton manages its own loading state

  const openKey = `${visible}|${item?.id}`;
  const [prevOpenKey, setPrevOpenKey] = useState<string | null>(null);
  if (prevOpenKey !== openKey) {
    setPrevOpenKey(openKey);
    if (visible && company?.guid && item) {
      setReason(''); setDirection(''); setNote(''); setAdjQty(1);
    }
  }

  // ── Load godowns when modal opens ──────────────────────────────────────────
  useEffect(() => {
    if (!visible || !company?.guid || !item) return;

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
      Toast.show({ type: 'error', text1: t('screens.componentsFormsStockAdjustmentModal.warehouseRequired'), text2: t('screens.componentsFormsStockAdjustmentModal.selectWarehouseToAdjust') });
      return false;
    }
    if (!adjQty || adjQty <= 0) {
      Toast.show({ type: 'error', text1: t('screens.componentsFormsStockAdjustmentModal.qtyRequired'), text2: t('screens.componentsFormsStockAdjustmentModal.enterPositiveQty') });
      return false;
    }
    if (!reason) {
      Toast.show({ type: 'error', text1: t('screens.componentsFormsStockAdjustmentModal.reasonRequired'), text2: t('screens.componentsFormsStockAdjustmentModal.selectReasonMsg') });
      return false;
    }
    if (isCorrection && !direction) {
      Toast.show({ type: 'error', text1: t('screens.componentsFormsStockAdjustmentModal.directionRequired'), text2: t('screens.componentsFormsStockAdjustmentModal.selectDirectionMsg') });
      return false;
    }
    // Prevent negative stock for reduce reasons
    if (effectiveEffect === 'reduce' && adjQty > (item?.qty || 0)) {
      Toast.show({ type: 'error', text1: t('screens.componentsFormsStockAdjustmentModal.exceedsStock'), text2: t('screens.componentsFormsStockAdjustmentModal.maxAdjustable', { qty: item?.qty, unit: item?.unit || t('screens.componentsFormsStockAdjustmentModal.units') }) });
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
        text1: queued ? t('screens.componentsFormsStockAdjustmentModal.adjustmentQueued') : t('screens.componentsFormsStockAdjustmentModal.adjustmentSavedCheck'),
        text2: queued
          ? t('screens.componentsFormsStockAdjustmentModal.savedWillPush')
          : t('screens.componentsFormsStockAdjustmentModal.adjustedInTally', { itemName }),
      });
    } catch (err: any) {
      // Entry may already be in write_queue; show warning not error
      Toast.show({ type: 'info', text1: t('screens.componentsFormsStockAdjustmentModal.adjustmentSaved'), text2: t('screens.componentsFormsStockAdjustmentModal.willPush') });
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
          <Text style={ms.title}>{t('screens.componentsFormsStockAdjustmentModal.adjustStock')}</Text>
        </View>
      )}
      footer={(
        <SubmitButton
          idleLabel={t('screens.componentsFormsStockAdjustmentModal.saveAdjustment')}
          loadingLabel={t('common.saving')}
          successLabel={t('screens.componentsFormsStockAdjustmentModal.adjustmentSavedTick')}
          onValidate={validate}
          onDone={handleDone}
        />
      )}
    >
      {item ? <ItemHeaderCard item={item} /> : null}

      <ReadonlyField label={t('screens.componentsFormsStockAdjustmentModal.currentQty')} value={item ? `${item.qty} ${item.unit || t('screens.componentsFormsStockAdjustmentModal.units')}` : '—'} />

      {itemGodowns.length > 1 ? (
        <InlineDropdownField
          label={t('screens.componentsFormsStockAdjustmentModal.warehouse')}
          options={itemGodowns.map(w => ({ id: w, label: w }))}
          value={warehouse}
          onSelect={(v) => { Keyboard.dismiss(); setWarehouse(v); }}
          placeholder={t('screens.componentsFormsStockAdjustmentModal.selectWarehouse')}
          required
        />
      ) : (
        <ReadonlyField label={t('screens.componentsFormsStockAdjustmentModal.warehouse')} value={warehouse || item?.warehouse || '—'} />
      )}

      <QtyStepperField
        label={t('screens.componentsFormsStockAdjustmentModal.adjustmentQty')}
        subLabel={t('screens.componentsFormsStockAdjustmentModal.requiredParen')}
        value={adjQty}
        onChange={setAdjQty}
      />

      <InlineDropdownField
        label={t('screens.componentsFormsStockAdjustmentModal.reason')}
        options={ADJUSTMENT_REASONS.map(r => ({ id: r.id, label: t(r.labelKey) }))}
        value={reason}
        onSelect={(v) => { Keyboard.dismiss(); setReason(v); setDirection(''); }}
        placeholder={t('screens.componentsFormsStockAdjustmentModal.selectReason')}
        required
      />

      {isCorrection && (
        <InlineDropdownField
          label={t('screens.componentsFormsStockAdjustmentModal.direction')}
          options={DIRECTION_OPTIONS.map(o => ({ id: o.id, label: t(o.labelKey) }))}
          value={direction}
          onSelect={(v) => { Keyboard.dismiss(); setDirection(v); }}
          placeholder={t('screens.componentsFormsStockAdjustmentModal.addOrReduce')}
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
            {t('screens.componentsFormsStockAdjustmentModal.effectPreview')}
          </Text>
          <Text style={{ fontSize: 14, fontWeight: '700', color: previewColor }}>
            {previewSign}{adjQty} → {newQty !== null ? `${newQty} ${item?.unit || t('screens.componentsFormsStockAdjustmentModal.units')}` : '—'}
          </Text>
        </View>
      )}

      <InlineField
        label={t('screens.componentsFormsStockAdjustmentModal.noteReference')}
        value={note}
        onChange={setNote}
        placeholder={t('screens.componentsFormsStockAdjustmentModal.notePlaceholder')}
        multiline
      />
    </BottomModalShell>
  );
}
