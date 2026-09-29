import React, { useState, useEffect } from 'react';
import { Keyboard, Text, StyleSheet } from 'react-native';
import Toast from 'react-native-toast-message';
import { useRouter } from 'expo-router';
import { safePush } from '../../utils/safeNavigation';
import { StockItem, ALL_TAX_RATES } from '../../data/stockData';
import { alterStockItem, checkHsnCode, getStockGroups } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { SPACING } from '../../constants/colors';

import {
  InlineDropdownField, InlineField, ReadonlyField,
  ItemHeaderCard, SubmitButton,
} from './StockFormHelpers';
import { BottomModalShell } from './BottomModalShell';
// EditStockModal — Stock Master Alteration (NOT a voucher).
// After save → cream masters preview only (no Share PDF), same as create item.
export function EditStockModal({
  visible, item, onClose,
}: {
  visible: boolean; item: StockItem | null; onClose: () => void;
}) {
  const router = useRouter();
  const { company } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [hsnCode,      setHsnCode]      = useState('');
  const [hsnHint,      setHsnHint]      = useState<string | null>(null);
  const [reorderLevel, setReorderLevel] = useState('');
  const [taxRateId,    setTaxRateId]    = useState('');
  const [groupName,    setGroupName]    = useState('');
  const [groupOptions, setGroupOptions] = useState<{id: string; label: string}[]>([]);
  const [notes,        setNotes]        = useState('');

  useEffect(() => {
    if (visible && item) {
      setHsnCode(item.hsn || '');
      setHsnHint(null);
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
    setHsnCode(''); setHsnHint(null); setReorderLevel(''); setTaxRateId(''); setGroupName(''); setNotes('');
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
      const currentHsn = (item.hsn || '').trim();
      const nextHsn = hsnCode.trim();
      const changes: Record<string, any> = {};
      if (nextHsn && nextHsn !== currentHsn) {
        const check: any = await checkHsnCode(nextHsn);
        if (check?.data?.valid === false) {
          setHsnHint('Invalid HSN — enter a valid GST HSN/SAC code to save.');
          Toast.show({ type: 'error', text1: 'Invalid HSN', text2: 'This code is not accepted.' });
          setIsSubmitting(false);
          return;
        }
        changes.hsnCode = nextHsn;
      }
      if (reorderLevel && reorderLevel !== String(item.reorderLevel ?? '')) {
        changes.reorderLevel = parseFloat(reorderLevel);
      }
      if (taxRateId) changes.taxRate = parseFloat(taxRateId);
      if (groupName && groupName !== (item.group || '')) changes.groupName = groupName;

      if (Object.keys(changes).length === 0) {
        Toast.show({ type: 'info', text1: 'No changes', text2: 'Values are the same as current.' });
        setIsSubmitting(false);
        return;
      }

      const res: any = await alterStockItem({
        companyGuid:  company.guid,
        companyName:  company.name || '',
        existingName: item.tallyName || item.name,
        changes,
      });

      Keyboard.dismiss();
      reset();
      onClose();

      const queued = res?.queued;
      const queueId = res?.queueId ?? res?.data?.queueId;

      setTimeout(() => {
        Toast.show({
          type: 'success',
          text1: queued ? 'Update Queued ⏳' : 'Item Updated ✅',
          text2: queued
            ? 'Saved. Will update in Tally when desktop connects.'
            : `${item.name} updated in Tally`,
        });
        if (queueId) {
          safePush(router, `/masters/preview?queueId=${encodeURIComponent(String(queueId))}` as any);
        }
      }, 300);
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
        onChange={(v) => { setHsnCode(v); setHsnHint(null); }}
        placeholder="e.g. 38089190"
        onBlur={async () => {
          const code = hsnCode.trim();
          if (!code) { setHsnHint(null); return; }
          try {
            const res: any = await checkHsnCode(code);
            if (res?.data?.valid === false) {
              setHsnHint('Invalid HSN — enter a valid GST HSN/SAC code to save.');
            } else {
              setHsnHint(null);
            }
          } catch {
            setHsnHint(null);
          }
        }}
      />
      {!!hsnHint && (
        <Text style={hsnStyles.hint}>{hsnHint}</Text>
      )}

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

const hsnStyles = StyleSheet.create({
  hint: {
    fontSize: 11, color: '#92400E', marginTop: -8, marginBottom: SPACING.md,
    lineHeight: 15, paddingHorizontal: 2,
  },
});
