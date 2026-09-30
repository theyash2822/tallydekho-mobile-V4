import React, { useState, useEffect } from 'react';
import { Keyboard, Text, StyleSheet } from 'react-native';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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

  const prefillKey = visible && item ? item.id : null;
  const [prevPrefillKey, setPrevPrefillKey] = useState<typeof prefillKey>(null);
  if (prefillKey !== prevPrefillKey) {
    setPrevPrefillKey(prefillKey);
    if (visible && item) {
      setHsnCode(item.hsn || '');
      setHsnHint(null);
      setReorderLevel(String(item.reorderLevel ?? ''));
      setTaxRateId('');
      setGroupName(item.group || '');
      setNotes('');
    }
  }

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
      Toast.show({ type: 'error', text1: t('screens.componentsFormsEditStockModal.nothingToUpdate'), text2: t('screens.componentsFormsEditStockModal.nothingToUpdateMsg') });
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
          setHsnHint(t('screens.componentsFormsEditStockModal.invalidHsnHint'));
          Toast.show({ type: 'error', text1: t('screens.componentsFormsEditStockModal.invalidHsn'), text2: t('screens.componentsFormsEditStockModal.invalidHsnMsg') });
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
        Toast.show({ type: 'info', text1: t('screens.componentsFormsEditStockModal.noChanges'), text2: t('screens.componentsFormsEditStockModal.noChangesMsg') });
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
          text1: queued ? t('screens.componentsFormsEditStockModal.updateQueued') : t('screens.componentsFormsEditStockModal.itemUpdated'),
          text2: queued
            ? t('screens.componentsFormsEditStockModal.updateQueuedMsg')
            : t('screens.componentsFormsEditStockModal.itemUpdatedMsg', { name: item.name }),
        });
        if (queueId) {
          safePush(router, `/masters/preview?queueId=${encodeURIComponent(String(queueId))}` as any);
        }
      }, 300);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: t('screens.componentsFormsEditStockModal.updateFailed'), text2: err?.message || t('screens.componentsFormsEditStockModal.pleaseTryAgain') });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => { Keyboard.dismiss(); reset(); onClose(); };

  return (
    <BottomModalShell
      visible={visible}
      onClose={handleClose}
      title={t('screens.componentsFormsEditStockModal.title')}
      footer={
        <SubmitButton
          idleLabel={t('screens.componentsFormsEditStockModal.updateInTally')}
          loadingLabel={t('screens.componentsFormsEditStockModal.updating')}
          successLabel={t('screens.componentsFormsEditStockModal.updatedCheck')}
          onValidate={validate}
          onDone={handleDone}
        />
      }
    >
      {item ? <ItemHeaderCard item={item} /> : null}

      <ReadonlyField label={t('screens.componentsFormsEditStockModal.itemName')} value={item?.name || '—'} />
      <ReadonlyField label={t('screens.componentsFormsEditStockModal.currentQty')} value={item ? String(item.qty) : '—'} />

      <InlineField
        label={t('screens.componentsFormsEditStockModal.hsnCode')}
        value={hsnCode}
        onChange={(v) => { setHsnCode(v); setHsnHint(null); }}
        placeholder={t('screens.componentsFormsEditStockModal.hsnPlaceholder')}
        onBlur={async () => {
          const code = hsnCode.trim();
          if (!code) { setHsnHint(null); return; }
          try {
            const res: any = await checkHsnCode(code);
            if (res?.data?.valid === false) {
              setHsnHint(t('screens.componentsFormsEditStockModal.invalidHsnHint'));
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
        label={t('screens.componentsFormsEditStockModal.reorderLevel')}
        value={reorderLevel}
        onChange={setReorderLevel}
        placeholder={t('screens.componentsFormsEditStockModal.reorderPlaceholder')}
      />

      <InlineDropdownField
        label={t('screens.componentsFormsEditStockModal.gstRate')}
        options={ALL_TAX_RATES}
        value={taxRateId}
        onSelect={setTaxRateId}
        placeholder={t('screens.componentsFormsEditStockModal.selectGstRate')}
      />

      <InlineDropdownField
        label={t('screens.componentsFormsEditStockModal.stockGroup')}
        options={groupOptions}
        value={groupName}
        onSelect={setGroupName}
        placeholder={groupOptions.length > 0 ? t('screens.componentsFormsEditStockModal.selectGroup') : t('screens.componentsFormsEditStockModal.loadingGroups')}
      />

      <InlineField
        label={t('screens.componentsFormsEditStockModal.notesReference')}
        value={notes}
        onChange={setNotes}
        placeholder={t('common.optional')}
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
