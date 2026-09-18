import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ScrollView, Keyboard } from 'react-native';
import Toast from 'react-native-toast-message';
import { StockItem } from '../../data/stockData';
import { getWarehouses, getStockGodowns, createStockTransfer } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { clearStockListCache } from '../../utils/stockCache';
import { useRbasCreate } from '../../hooks/useRbasCreate';

import {
  InlineDropdownField, InlineField, ReadonlyField,
  QtyStepperField, ItemHeaderCard, SubmitButton,
} from './StockFormHelpers';
import { BottomModalShell } from './BottomModalShell';

function parseGodownNames(res: any): string[] {
  const d = res?.data;
  if (d?.warehouses && Array.isArray(d.warehouses)) {
    return d.warehouses.map((g: any) => g.name || g).filter(Boolean);
  }
  if (Array.isArray(d)) {
    return d.map((g: any) => (typeof g === 'string' ? g : g.name)).filter(Boolean);
  }
  return [];
}

export function StockTransferModal({
  visible, item, onClose,
}: {
  visible: boolean; item: StockItem | null; onClose: () => void;
}) {
  const { company } = useAuth();
  const { scopeGodowns, assertCanCreate } = useRbasCreate();
  const scrollRef = useRef<ScrollView>(null);

  const [sourceWhName, setSourceWhName] = useState('');
  const [destWhName,   setDestWhName]   = useState('');
  const [transferQty,  setTransferQty]  = useState(1);
  const [narration,    setNarration]    = useState('');

  const [allWarehouses, setAllWarehouses] = useState<string[]>([]);
  const [itemGodowns,   setItemGodowns]   = useState<string[]>([]);
  const [isSubmitting,  setIsSubmitting]  = useState(false);

  const scrollNoteIntoView = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd?.({ animated: true });
    }, 250);
  }, []);

  useEffect(() => {
    if (!visible || !company?.guid || !item) return;

    getWarehouses(company.guid).then((res: any) => {
      const wh = scopeGodowns(Array.isArray(res?.data) ? res.data : []);
      setAllWarehouses(wh.map((w: any) => w.name).filter(Boolean));
    }).catch(() => {});

    getStockGodowns(company.guid, item.id).then((res: any) => {
      const godowns = scopeGodowns(
        parseGodownNames(res).map((name) => ({ name })),
      ).map((g: any) => g.name);
      setItemGodowns(godowns);
      if (godowns.length === 1) {
        setSourceWhName(godowns[0]);
      } else if (godowns.length === 0) {
        setSourceWhName(item.warehouse || '');
      } else {
        setSourceWhName('');
      }
    }).catch(() => {
      setSourceWhName(item.warehouse || '');
    });

    setDestWhName('');
    setTransferQty(1);
    setNarration('');
  }, [visible, item?.id, company?.guid, scopeGodowns]);

  const sourceOptions = itemGodowns.map(n => ({ id: n, label: n }));
  const destOptions   = allWarehouses
    .filter(n => n !== sourceWhName)
    .map(n => ({ id: n, label: n }));

  const reset = () => {
    setSourceWhName(''); setDestWhName('');
    setTransferQty(1); setNarration('');
  };

  const validate = () => {
    if (!assertCanCreate('stock_transfer.create')) return false;
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
      clearStockListCache();
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
    <BottomModalShell
      visible={visible}
      onClose={handleClose}
      title="Stock Transfer"
      keyboardAvoiding={false}
      scrollRef={scrollRef}
      scrollContentStyle={{ paddingBottom: 56 }}
      scrollProps={{
        keyboardDismissMode: 'interactive',
        automaticallyAdjustKeyboardInsets: true,
      }}
      footer={(
        <SubmitButton
          idleLabel="Transfer"
          loadingLabel="Transferring..."
          successLabel="✓ Transferred"
          onValidate={validate}
          onDone={handleDone}
        />
      )}
    >
      {item ? <ItemHeaderCard item={item} /> : null}

      {sourceOptions.length === 1 ? (
        <ReadonlyField label="Source Warehouse" value={sourceWhName} />
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

      <ReadonlyField label="On-hand Qty" value={item ? String(item.qty) : '—'} />

      <InlineDropdownField
        label="Destination Warehouse"
        options={destOptions}
        value={destWhName}
        onSelect={setDestWhName}
        placeholder="Select destination"
        icon="home-outline"
        required
      />

      <QtyStepperField
        label="Qty to Transfer"
        subLabel="(required)"
        value={transferQty}
        onChange={setTransferQty}
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
