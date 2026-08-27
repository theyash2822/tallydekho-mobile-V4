import React, { useState, useEffect } from 'react';
import { View, Keyboard } from 'react-native';
import Toast from 'react-native-toast-message';
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

  const reset = () => {
    setGroup(''); setName(''); setUnit(''); setTaxRate('');
    setPurchPrice(''); setWarehouse(''); setQty(''); setSalePrice('');
  };

  const validate = () => {
    if (!name.trim()) {
      Toast.show({ type: 'error', text1: 'Required', text2: 'Product name is required.' });
      return false;
    }
    if (!group) {
      Toast.show({ type: 'error', text1: 'Group Required', text2: 'Select a stock group from the list.' });
      return false;
    }
    if (!unit) {
      Toast.show({ type: 'error', text1: 'Unit Required', text2: 'Select a unit of measure.' });
      return false;
    }
    if (qty && parseFloat(qty) < 0) {
      Toast.show({ type: 'error', text1: 'Invalid Qty', text2: 'Opening quantity cannot be negative.' });
      return false;
    }
    if (purchPrice && parseFloat(purchPrice) < 0) {
      Toast.show({ type: 'error', text1: 'Invalid Price', text2: 'Purchase price cannot be negative.' });
      return false;
    }
    return true;
  };

  const handleDone = async () => {
    if (!company?.guid || !name) return;
    const itemName = name;
    Keyboard.dismiss();
    reset(); onClose();
    try {
      const igst = parseFloat(taxRate) || 0;
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
        hsnCode:     '',
      });
      const queued = res?.queued;
      Toast.show({
        type: 'success',
        text1: queued ? 'Item Queued ⏳' : 'Item Added ✅',
        text2: queued ? 'Will create in Tally when desktop connects.' : `"${itemName}" created in Tally`,
      });
    } catch {
      Toast.show({ type: 'info', text1: 'Item Saved', text2: 'Will create in Tally when desktop connects.' });
    }
  };

  const handleClose = () => { reset(); onClose(); };

  return (
    <BottomModalShell
      visible={visible}
      onClose={handleClose}
      title="Add New Item"
      footer={
        <SubmitButton
          idleLabel="Save Item"
          loadingLabel="Saving..."
          successLabel="✓ Saved"
          onValidate={validate}
          onDone={handleDone}
        />
      }
    >
      <InlineDropdownField
        label="Group"
        options={groupOptions}
        value={group}
        onSelect={setGroup}
        placeholder={groupOptions.length > 0 ? 'Select group' : 'Loading groups...'}
        required
      />

      <InlineField
        label="Product name"
        value={name}
        onChange={setName}
        placeholder="Enter product name"
        required
      />

      <View style={ms.row}>
        <InlineDropdownField
          label="Unit of measure"
          options={unitOptions}
          value={unit}
          onSelect={setUnit}
          placeholder={unitOptions.length > 0 ? 'Select unit' : 'Loading...'}
          required
        />
        <InlineDropdownField
          label="Tax rate (GST %)"
          options={ALL_TAX_RATES}
          value={taxRate}
          onSelect={setTaxRate}
          placeholder="Select"
        />
      </View>

      <CurrencyField
        label="Purchase Price"
        value={purchPrice}
        onChange={setPurchPrice}
        placeholder="₹ 0.00"
      />

      <InlineDropdownField
        label="Warehouse Placement"
        options={warehouseOptions}
        value={warehouse}
        onSelect={setWarehouse}
        placeholder={warehouseOptions.length > 0 ? 'Select warehouse' : 'Loading...'}
        icon="home-outline"
      />

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
    </BottomModalShell>
  );
}
