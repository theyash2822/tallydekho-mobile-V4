import React, { useState, useEffect } from 'react';
import { Keyboard } from 'react-native';
import Toast from 'react-native-toast-message';
import { StockItem, ALL_TAX_RATES } from '../../data/stockData';
import { alterStockItem, getStockGroups } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

import {
  InlineDropdownField, InlineField, ReadonlyField,
  ItemHeaderCard, SubmitButton,
} from './StockFormHelpers';
import { BottomModalShell } from './BottomModalShell';

// EditStockModal — Stock Master Alteration (NOT a voucher)
export function EditStockModal({
  visible, item, onClose,
}: {
  visible: boolean; item: StockItem | null; onClose: () => void;
}) {
  const { company } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      setGroupName(item.group || '');
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
    <BottomModalShell
      visible={visible}
      onClose={handleClose}
      title="Edit Stock Item"
      footer={
        <SubmitButton
          idleLabel="Update in Tally"
          loadingLabel="Updating..."
          successLabel="✓ Updated"
          onValidate={validate}
          onDone={handleDone}
        />
      }
    >
      {item ? <ItemHeaderCard item={item} /> : null}

      <ReadonlyField label="Item Name"   value={item?.name || '—'} />
      <ReadonlyField label="Current Qty" value={item ? String(item.qty) : '—'} />

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
    </BottomModalShell>
  );
}
