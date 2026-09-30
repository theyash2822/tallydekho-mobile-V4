import React, { useState, useEffect } from 'react';
import { View, Keyboard } from 'react-native';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import { ALL_TAX_RATES } from '../../data/stockData';
import { useAuth } from '../../context/AuthContext';
import { createStockItem, getStockGroups, getStockUnits, getWarehouses } from '../../services/api';

import {
  InlineDropdownField, InlineField, CurrencyField, SubmitButton,
  modalStyles as ms,
} from './StockFormHelpers';
import { BottomModalShell } from './BottomModalShell';

export function AddItemModal({
  visible, onClose,
}: {
  visible: boolean; onClose: () => void;
}) {
  const { t } = useTranslation();
  const { company } = useAuth();

  const [groupOptions,     setGroupOptions]     = useState<{id:string;label:string}[]>([]);
  const [unitOptions,      setUnitOptions]      = useState<{id:string;label:string}[]>([]);
  const [warehouseOptions, setWarehouseOptions] = useState<{id:string;label:string}[]>([]);

  useEffect(() => {
    if (!visible || !company?.guid) return;
    getStockGroups(company.guid)
      .then((res: any) => setGroupOptions((res?.data || []).map((g: string) => ({ id: g, label: g }))))
      .catch(() => {});
    getStockUnits(company.guid)
      .then((res: any) => setUnitOptions((res?.data || []).map((u: string) => ({ id: u, label: u }))))
      .catch(() => {});
    getWarehouses(company.guid)
      .then((res: any) => {
        const wh = res?.data ?? (Array.isArray(res) ? res : []);
        setWarehouseOptions(wh.map((w: any) => ({ id: w.name, label: w.name })));
      })
      .catch(() => {});
  }, [visible, company?.guid]);

  const [group,      setGroup]      = useState('');
  const [name,       setName]       = useState('');
  const [unit,       setUnit]       = useState('');
  const [taxRate,    setTaxRate]    = useState('');
  const [purchPrice, setPurchPrice] = useState('');
  const [warehouse,  setWarehouse]  = useState('');
  const [qty,        setQty]        = useState('');
  const [salePrice,  setSalePrice]  = useState('');
  const [hsnCode,    setHsnCode]    = useState('');

  const reset = () => {
    setGroup(''); setName(''); setUnit(''); setTaxRate('');
    setPurchPrice(''); setWarehouse(''); setQty(''); setSalePrice(''); setHsnCode('');
  };

  const validate = () => {
    if (!name.trim()) {
      Toast.show({ type: 'error', text1: t('common.required'), text2: t('screens.componentsFormsAddItemModal.productNameRequired') });
      return false;
    }
    if (!group) {
      Toast.show({ type: 'error', text1: t('screens.componentsFormsAddItemModal.groupRequired'), text2: t('screens.componentsFormsAddItemModal.groupRequiredMsg') });
      return false;
    }
    if (!unit) {
      Toast.show({ type: 'error', text1: t('screens.componentsFormsAddItemModal.unitRequired'), text2: t('screens.componentsFormsAddItemModal.unitRequiredMsg') });
      return false;
    }
    if (qty && parseFloat(qty) < 0) {
      Toast.show({ type: 'error', text1: t('screens.componentsFormsAddItemModal.invalidQty'), text2: t('screens.componentsFormsAddItemModal.invalidQtyMsg') });
      return false;
    }
    if (purchPrice && parseFloat(purchPrice) < 0) {
      Toast.show({ type: 'error', text1: t('screens.componentsFormsAddItemModal.invalidPrice'), text2: t('screens.componentsFormsAddItemModal.invalidPriceMsg') });
      return false;
    }
    return true;
  };

  const handleDone = async () => {
    if (!company?.guid || !name) throw new Error('incomplete');
    const itemName = name;
    Keyboard.dismiss();
    const igst = parseFloat(taxRate) || 0;
    try {
      const res: any = await createStockItem({
        companyGuid: company.guid,
        companyName: company.name || '',
        name:        itemName,
        groupName:   group,
        unit:        unit  || 'Nos',
        openingQty:  parseFloat(qty) || 0,
        openingRate: parseFloat(purchPrice) || 0,
        igstRate:    igst,
        cgstRate:    igst / 2,
        sgstRate:    igst / 2,
        hsnCode:     hsnCode.trim(),
      });
      const queued = res?.queued;
      Toast.show({
        type: 'success',
        text1: queued ? t('screens.componentsFormsAddItemModal.itemQueued') : t('screens.componentsFormsAddItemModal.itemAdded'),
        text2: queued ? t('screens.componentsFormsAddItemModal.itemQueuedMsg') : t('screens.componentsFormsAddItemModal.itemCreatedMsg', { name: itemName }),
      });
      reset();
      onClose();
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: t('screens.componentsFormsAddItemModal.saveFailed'),
        text2: e?.message || t('screens.componentsFormsAddItemModal.pleaseTryAgain'),
      });
      throw e;
    }
  };

  const handleClose = () => { reset(); onClose(); };

  return (
    <BottomModalShell
      visible={visible}
      onClose={handleClose}
      title={t('screens.componentsFormsAddItemModal.title')}
      footer={
        <SubmitButton
          idleLabel={t('screens.componentsFormsAddItemModal.saveItem')}
          loadingLabel={t('common.saving')}
          successLabel={t('screens.componentsFormsAddItemModal.savedCheck')}
          onValidate={validate}
          onDone={handleDone}
        />
      }
    >
      <InlineDropdownField
        label={t('screens.componentsFormsAddItemModal.group')}
        options={groupOptions}
        value={group}
        onSelect={setGroup}
        placeholder={groupOptions.length > 0 ? t('screens.componentsFormsAddItemModal.selectGroup') : t('screens.componentsFormsAddItemModal.loadingGroups')}
        required
      />

      <InlineField
        label={t('screens.componentsFormsAddItemModal.productName')}
        value={name}
        onChange={setName}
        placeholder={t('screens.componentsFormsAddItemModal.productNamePlaceholder')}
        required
      />

      <InlineField
        label={t('screens.componentsFormsAddItemModal.hsn')}
        value={hsnCode}
        onChange={setHsnCode}
        placeholder={t('screens.componentsFormsAddItemModal.hsnPlaceholder')}
        keyboardType="numeric"
      />

      <View style={ms.row}>
        <InlineDropdownField
          label={t('screens.componentsFormsAddItemModal.unitOfMeasure')}
          options={unitOptions}
          value={unit}
          onSelect={setUnit}
          placeholder={unitOptions.length > 0 ? t('screens.componentsFormsAddItemModal.selectUnit') : t('common.loading')}
          required
        />
        <InlineDropdownField
          label={t('screens.componentsFormsAddItemModal.taxRate')}
          options={ALL_TAX_RATES}
          value={taxRate}
          onSelect={setTaxRate}
          placeholder={t('common.select')}
        />
      </View>

      <CurrencyField
        label={t('screens.componentsFormsAddItemModal.purchasePrice')}
        value={purchPrice}
        onChange={setPurchPrice}
        placeholder="₹ 0.00"
      />

      <InlineDropdownField
        label={t('screens.componentsFormsAddItemModal.warehousePlacement')}
        options={warehouseOptions}
        value={warehouse}
        onSelect={setWarehouse}
        placeholder={warehouseOptions.length > 0 ? t('screens.componentsFormsAddItemModal.selectWarehouse') : t('common.loading')}
        icon="home-outline"
      />

      <View style={ms.row}>
        <InlineField
          label={t('screens.componentsFormsAddItemModal.openingQty')}
          value={qty}
          onChange={setQty}
          placeholder="0"
          keyboardType="numeric"
        />
        <CurrencyField
          label={t('screens.componentsFormsAddItemModal.salePrice')}
          value={salePrice}
          onChange={setSalePrice}
          placeholder="₹ 0.00"
        />
      </View>
    </BottomModalShell>
  );
}
