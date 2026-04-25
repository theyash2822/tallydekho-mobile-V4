import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput,
  Modal, Animated, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import DateRangePickerModal from '../../src/components/DateRangePickerModal';
import FormField from '../../src/components/forms/FormField';

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type StockItem = {
  id: string; name: string; sku: string; category: string;
  group: string; warehouse: string; qty: number; value: string;
  icon: string; iconColor: string; iconBg: string;
};

// ─── MOCK DATA ────────────────────────────────────────────────────────────────

export const STOCK_ITEMS: StockItem[] = [
  { id: 'SI01', name: 'Black JBL Speaker',      sku: 'PRD-1002-ABC', category: 'Audio',       group: 'Consumer Electronics', warehouse: 'WH01', qty: 85,  value: '₹4,200',  icon: 'cube-outline', iconColor: '#1A1A1A', iconBg: '#E8E7E1' },
  { id: 'SI02', name: 'USB-C Cable 3A',          sku: 'USB-3A-1M',   category: 'Accessories', group: 'Mobile Accessories',   warehouse: 'WH01', qty: 320, value: '₹450',    icon: 'cube-outline', iconColor: '#1A1A1A', iconBg: '#E8E7E1' },
  { id: 'SI03', name: 'Wireless Mouse M220',     sku: 'LOG-M220',    category: 'Peripherals', group: 'Office Peripherals',   warehouse: 'WH02', qty: 64,  value: '₹2,800',  icon: 'cube-outline', iconColor: '#1A1A1A', iconBg: '#E8E7E1' },
  { id: 'SI04', name: 'HDMI Cable 1.5m',         sku: 'HDM-1.5',     category: 'Accessories', group: 'Mobile Accessories',   warehouse: 'WH02', qty: 140, value: '₹780',    icon: 'cube-outline', iconColor: '#1A1A1A', iconBg: '#E8E7E1' },
  { id: 'SI05', name: 'Laptop Stand Adjustable', sku: 'LST-ADJ01',   category: 'Furniture',   group: 'Office Supplies',      warehouse: 'WH01', qty: 28,  value: '₹5,400',  icon: 'cube-outline', iconColor: '#1A1A1A', iconBg: '#E8E7E1' },
  { id: 'SI06', name: 'Mechanical Keyboard',     sku: 'LOG-MK235',   category: 'Peripherals', group: 'Office Peripherals',   warehouse: 'WH03', qty: 42,  value: '₹6,900',  icon: 'cube-outline', iconColor: '#1A1A1A', iconBg: '#E8E7E1' },
  { id: 'SI07', name: 'Power Bank 20000mAh',     sku: 'AMZ-PB20K',   category: 'Mobiles',     group: 'Mobile Accessories',   warehouse: 'WH03', qty: 95,  value: '₹1,800',  icon: 'cube-outline', iconColor: '#1A1A1A', iconBg: '#E8E7E1' },
  { id: 'SI08', name: 'Monitor 27" IPS',         sku: 'BNQ-27IPS',   category: 'Electronics', group: 'Consumer Electronics', warehouse: 'WH01', qty: 12,  value: '₹21,000', icon: 'cube-outline', iconColor: '#1A1A1A', iconBg: '#E8E7E1' },
  { id: 'SI09', name: 'TWS Earbuds Pro',          sku: 'TWS-PRO-01',  category: 'Audio',       group: 'Consumer Electronics', warehouse: 'WH02', qty: 58,  value: '₹2,200',  icon: 'cube-outline', iconColor: '#1A1A1A', iconBg: '#E8E7E1' },
  { id: 'SI10', name: 'Type-C Hub 7-in-1',        sku: 'USB-C71',     category: 'Accessories', group: 'Mobile Accessories',   warehouse: 'WH04', qty: 76,  value: '₹1,600',  icon: 'cube-outline', iconColor: '#1A1A1A', iconBg: '#E8E7E1' },
];

const ALL_WAREHOUSES = [
  { id: 'WH01', label: 'WH01 – Mumbai' },
  { id: 'WH02', label: 'WH02 – Delhi' },
  { id: 'WH03', label: 'WH03 – Bangalore' },
  { id: 'WH04', label: 'WH04 – Hyderabad' },
];

const ALL_CATEGORIES  = ['Audio', 'Accessories', 'Peripherals', 'Furniture', 'Mobiles', 'Electronics'];
const ALL_GROUPS      = ['Consumer Electronics', 'Mobile Accessories', 'Office Peripherals', 'Office Supplies'];
const ALL_UNITS       = ['pcs', 'kg', 'box', 'set', 'dozen', 'litre'];
const ADJ_REASONS     = ['Physical Count', 'Damage / Loss', 'Customer Return', 'Supplier Return', 'Other'];

// ─── CHIP SELECTOR (reusable) ─────────────────────────────────────────────────

function ChipSelector({
  label, options, selected, multi = true, onSelect,
}: {
  label: string;
  options: { id: string; label: string }[];
  selected: string[];
  multi?: boolean;
  onSelect: (ids: string[]) => void;
}) {
  const toggle = (id: string) => {
    if (multi) {
      onSelect(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
    } else {
      onSelect(selected.includes(id) ? [] : [id]);
    }
  };
  return (
    <View style={chip.wrap}>
      <Text style={chip.label}>{label}</Text>
      <View style={chip.row}>
        {options.map(opt => (
          <TouchableOpacity
            key={opt.id}
            style={[chip.item, selected.includes(opt.id) && chip.itemActive]}
            onPress={() => toggle(opt.id)}
            activeOpacity={0.7}
          >
            <Text style={[chip.text, selected.includes(opt.id) && chip.textActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
const chip = StyleSheet.create({
  wrap:      { marginBottom: SPACING.md },
  label:     { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  row:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  item:      { paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.full, borderWidth: 1.5, borderColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg },
  itemActive:{ backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  text:      { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  textActive:{ color: COLORS.white },
});

// ─── SWIPEABLE STOCK CARD ─────────────────────────────────────────────────────

function SwipeableStockCard({
  item, isMultiSelectMode, isSelected,
  onPress, onLongPress, onEditStock, onTransfer,
}: {
  item: StockItem;
  isMultiSelectMode: boolean;
  isSelected: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onEditStock: () => void;
  onTransfer: () => void;
}) {
  const swipeRef = useRef<any>(null);

  const renderLeftActions = (
    _: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const scale = dragX.interpolate({ inputRange: [0, 80], outputRange: [0.85, 1], extrapolate: 'clamp' });
    return (
      <Animated.View style={[sw.actionWrap, sw.transferBg, { transform: [{ scale }] }]}>
        <TouchableOpacity
          style={sw.actionInner}
          onPress={() => { swipeRef.current?.close(); onTransfer(); }}
          activeOpacity={0.85}
        >
          <Ionicons name="swap-horizontal-outline" size={22} color={COLORS.white} />
          <Text style={sw.actionTxt}>Transfer</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderRightActions = (
    _: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const scale = dragX.interpolate({ inputRange: [-80, 0], outputRange: [1, 0.85], extrapolate: 'clamp' });
    return (
      <Animated.View style={[sw.actionWrap, sw.editBg, { transform: [{ scale }] }]}>
        <TouchableOpacity
          style={sw.actionInner}
          onPress={() => { swipeRef.current?.close(); onEditStock(); }}
          activeOpacity={0.85}
        >
          <Ionicons name="create-outline" size={22} color={COLORS.white} />
          <Text style={sw.actionTxt}>Edit Stock</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const cardInner = (
    <TouchableOpacity
      style={[sc.card, isSelected && sc.cardSelected]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.85}
      delayLongPress={380}
    >
      {isMultiSelectMode ? (
        <View style={[sc.checkbox, isSelected && sc.checkboxActive]}>
          {isSelected && <Ionicons name="checkmark" size={12} color={COLORS.white} />}
        </View>
      ) : null}
      <View style={sc.icon}>
        <Ionicons name="cube-outline" size={20} color={COLORS.textPrimary} />
      </View>
      <View style={sc.info}>
        <Text style={sc.name} numberOfLines={1}>{item.name}</Text>
        <Text style={sc.sku}>{item.sku} · {item.category}</Text>
      </View>
      <View style={sc.right}>
        <Text style={sc.value}>{item.value}</Text>
        <View style={sc.qtyBadge}>
          <Text style={sc.qtyTxt}>{item.qty} units</Text>
        </View>
      </View>
      {!isMultiSelectMode && (
        <Ionicons name="chevron-forward" size={14} color={COLORS.textTertiary} style={{ marginLeft: 4 }} />
      )}
    </TouchableOpacity>
  );

  if (isMultiSelectMode) return cardInner;

  return (
    <Swipeable
      ref={swipeRef}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      friction={2}
      leftThreshold={40}
      rightThreshold={40}
      overshootLeft={false}
      overshootRight={false}
    >
      {cardInner}
    </Swipeable>
  );
}

const sw = StyleSheet.create({
  actionWrap:  { width: 88, justifyContent: 'center', alignItems: 'center', borderRadius: RADIUS.md, overflow: 'hidden' },
  transferBg:  { backgroundColor: COLORS.brandPrimary },
  editBg:      { backgroundColor: '#A89060' },
  actionInner: { flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center', gap: 5 },
  actionTxt:   { fontSize: 11, fontWeight: '700', color: COLORS.white },
});

const sc = StyleSheet.create({
  card:          { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, padding: SPACING.sm, borderWidth: 1, borderColor: COLORS.borderDefault },
  cardSelected:  { borderColor: '#1A1A1A', borderWidth: 1.5, backgroundColor: '#F0EFE9' },
  icon:          { width: 42, height: 42, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8E7E1' },
  checkbox:      { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: COLORS.borderStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.cardBg },
  checkboxActive:{ backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  info:          { flex: 1 },
  name:          { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  sku:           { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },
  right:         { alignItems: 'flex-end', gap: 4 },
  value:         { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  qtyBadge:      { backgroundColor: COLORS.pageBg, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: COLORS.borderDefault },
  qtyTxt:        { fontSize: 10, fontWeight: '600', color: COLORS.textSecondary },
});

// ─── MODAL SHARED STYLES ──────────────────────────────────────────────────────

const ms = StyleSheet.create({
  overlay:            { flex: 1, backgroundColor: 'rgba(0,0,0,0.48)' },
  sheet:              { backgroundColor: COLORS.cardBg, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '90%', paddingTop: 10 },
  handle:             { width: 40, height: 4, backgroundColor: COLORS.borderStrong, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  titleRow:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  title:              { fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  clearTxt:           { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: '#A89060' },
  scroll:             { padding: SPACING.md },
  btnRow:             { flexDirection: 'row', gap: 12, paddingHorizontal: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.borderDefault, marginBottom: 4 },
  cancelBtn:          { flex: 1, paddingVertical: 14, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.borderDefault, alignItems: 'center', justifyContent: 'center' },
  cancelTxt:          { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textSecondary },
  applyBtn:           { flex: 2, flexDirection: 'row', gap: 8, paddingVertical: 14, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  applyTxt:           { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
  readonlyRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  readonlyIcon:       { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8E7E1' },
  readonlyLabel:      { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontWeight: '500' },
  readonlyVal:        { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, marginTop: 2 },
  readonlyField:      { marginBottom: SPACING.md },
  readonlyFieldLabel: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  readonlyFieldVal:   { backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 13, fontSize: TYPOGRAPHY.base, color: COLORS.textSecondary },
  toggleWrap:         { flexDirection: 'row', gap: 10, marginBottom: SPACING.md },
  toggleBtn:          { flex: 1, flexDirection: 'row', gap: 6, paddingVertical: 11, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.borderDefault, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.cardBg },
  toggleActive:       { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  toggleRemove:       { backgroundColor: '#C0392B', borderColor: '#C0392B' },
  toggleTxt:          { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  toggleTxtActive:    { color: COLORS.white },
  infoBanner:         { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#E8E7E1', borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.md },
  infoBannerTxt:      { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
});

// ─── FILTER MODAL ─────────────────────────────────────────────────────────────

function FilterModal({
  visible, onClose, onApply, initWh, initCat, initGrp,
}: {
  visible: boolean;
  onClose: () => void;
  onApply: (wh: string[], cat: string[], grp: string[]) => void;
  initWh: string[]; initCat: string[]; initGrp: string[];
}) {
  const insets = useSafeAreaInsets();
  const [selWh,  setSelWh]  = useState<string[]>(initWh);
  const [selCat, setSelCat] = useState<string[]>(initCat);
  const [selGrp, setSelGrp] = useState<string[]>(initGrp);

  React.useEffect(() => {
    if (visible) { setSelWh(initWh); setSelCat(initCat); setSelGrp(initGrp); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const total = selWh.length + selCat.length + selGrp.length;
  const handleClear  = () => { setSelWh([]); setSelCat([]); setSelGrp([]); };
  const handleApply  = () => { onApply(selWh, selCat, selGrp); onClose(); };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={ms.overlay} activeOpacity={1} onPress={onClose} />
      <View style={[ms.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={ms.handle} />
        <View style={ms.titleRow}>
          <Text style={ms.title}>Filter Items</Text>
          <TouchableOpacity onPress={handleClear} activeOpacity={0.7}>
            <Text style={ms.clearTxt}>{total > 0 ? `Clear All (${total})` : 'Clear All'}</Text>
          </TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ms.scroll}>
          <ChipSelector label="Warehouse" options={ALL_WAREHOUSES} selected={selWh} multi onSelect={setSelWh} />
          <ChipSelector label="Category"  options={ALL_CATEGORIES.map(c => ({ id: c, label: c }))} selected={selCat} multi onSelect={setSelCat} />
          <ChipSelector label="Group"     options={ALL_GROUPS.map(g => ({ id: g, label: g }))} selected={selGrp} multi onSelect={setSelGrp} />
        </ScrollView>
        <View style={ms.btnRow}>
          <TouchableOpacity style={ms.cancelBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={ms.cancelTxt}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={ms.applyBtn} onPress={handleApply} activeOpacity={0.7}>
            <Ionicons name="checkmark-circle" size={16} color={COLORS.white} />
            <Text style={ms.applyTxt}>Apply Filters</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── ADD ITEM MODAL ───────────────────────────────────────────────────────────

type AddForm = {
  name: string; sku: string; category: string[]; group: string[];
  warehouse: string[]; qty: string; unit: string[];
  purchaseRate: string; sellingPrice: string;
};

const emptyAddForm = (): AddForm => ({
  name: '', sku: '', category: [], group: [], warehouse: ['WH01'],
  qty: '', unit: ['pcs'], purchaseRate: '', sellingPrice: '',
});

function AddItemModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<AddForm>(emptyAddForm());
  const upd = (k: keyof AddForm, v: any) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = () => {
    if (!form.name.trim() || !form.sku.trim()) {
      Toast.show({ type: 'error', text1: 'Required Fields', text2: 'Item Name and SKU are required.' });
      return;
    }
    Toast.show({ type: 'success', text1: 'Item Added', text2: `"${form.name}" added to inventory.` });
    setForm(emptyAddForm());
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableOpacity style={ms.overlay} activeOpacity={1} onPress={onClose} />
        <View style={[ms.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={ms.handle} />
          <View style={ms.titleRow}>
            <Text style={ms.title}>Add New Item</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ms.scroll} keyboardShouldPersistTaps="handled">
            <FormField label="Item Name" value={form.name} onChangeText={v => upd('name', v)} placeholder="e.g. Apple iPhone 16" required />
            <FormField label="SKU / Item Code" value={form.sku} onChangeText={v => upd('sku', v)} placeholder="e.g. APL-IP16-128" required autoCapitalize="characters" />
            <ChipSelector label="Category" options={ALL_CATEGORIES.map(c => ({ id: c, label: c }))} selected={form.category} multi={false} onSelect={v => upd('category', v)} />
            <ChipSelector label="Group" options={ALL_GROUPS.map(g => ({ id: g, label: g }))} selected={form.group} multi={false} onSelect={v => upd('group', v)} />
            <ChipSelector label="Warehouse" options={ALL_WAREHOUSES} selected={form.warehouse} multi={false} onSelect={v => upd('warehouse', v)} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <FormField label="Opening Qty *" value={form.qty} onChangeText={v => upd('qty', v)} keyboardType="numeric" placeholder="0" />
              </View>
              <View style={{ flex: 1 }}>
                <ChipSelector label="Unit" options={ALL_UNITS.map(u => ({ id: u, label: u }))} selected={form.unit} multi={false} onSelect={v => upd('unit', v)} />
              </View>
            </View>
            <FormField label="Purchase Rate (₹)" value={form.purchaseRate} onChangeText={v => upd('purchaseRate', v)} keyboardType="decimal-pad" placeholder="0.00" />
            <FormField label="Selling Price (₹)" value={form.sellingPrice} onChangeText={v => upd('sellingPrice', v)} keyboardType="decimal-pad" placeholder="0.00" containerStyle={{ marginBottom: 0 }} />
          </ScrollView>
          <View style={ms.btnRow}>
            <TouchableOpacity style={ms.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={ms.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ms.applyBtn} onPress={handleSave} activeOpacity={0.7}>
              <Ionicons name="add-circle" size={16} color={COLORS.white} />
              <Text style={ms.applyTxt}>Add Item</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── EDIT STOCK MODAL ─────────────────────────────────────────────────────────

function EditStockModal({
  visible, item, onClose,
}: {
  visible: boolean; item: StockItem | null; onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [adjQty, setAdjQty]   = useState('');
  const [adjType, setAdjType] = useState<'add' | 'remove'>('add');
  const [reason, setReason]   = useState<string[]>([]);
  const [notes, setNotes]     = useState('');

  const reset = () => { setAdjQty(''); setReason([]); setNotes(''); setAdjType('add'); };

  const handleSave = () => {
    if (!adjQty.trim()) {
      Toast.show({ type: 'error', text1: 'Required', text2: 'Please enter adjustment quantity.' });
      return;
    }
    const dir = adjType === 'add' ? '+' : '–';
    Toast.show({ type: 'success', text1: 'Stock Updated', text2: `${item?.name} adjusted by ${dir}${adjQty} units.` });
    reset(); onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { reset(); onClose(); }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableOpacity style={ms.overlay} activeOpacity={1} onPress={() => { reset(); onClose(); }} />
        <View style={[ms.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={ms.handle} />
          <View style={ms.titleRow}>
            <Text style={ms.title}>Edit Stock</Text>
            <TouchableOpacity onPress={() => { reset(); onClose(); }} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ms.scroll} keyboardShouldPersistTaps="handled">
            {/* Current item info */}
            <View style={ms.readonlyRow}>
              <View style={ms.readonlyIcon}>
                <Ionicons name="cube-outline" size={18} color={COLORS.textPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={ms.readonlyLabel}>Item</Text>
                <Text style={ms.readonlyVal} numberOfLines={1}>{item?.name}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={ms.readonlyLabel}>Current Qty</Text>
                <Text style={[ms.readonlyVal, { color: COLORS.brandPrimary }]}>{item?.qty} units</Text>
              </View>
            </View>
            {/* Adjustment type toggle */}
            <View style={ms.toggleWrap}>
              <TouchableOpacity
                style={[ms.toggleBtn, adjType === 'add' && ms.toggleActive]}
                onPress={() => setAdjType('add')}
                activeOpacity={0.7}
              >
                <Ionicons name="add-circle-outline" size={16} color={adjType === 'add' ? COLORS.white : COLORS.textSecondary} />
                <Text style={[ms.toggleTxt, adjType === 'add' && ms.toggleTxtActive]}>Add Stock</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[ms.toggleBtn, adjType === 'remove' && ms.toggleRemove]}
                onPress={() => setAdjType('remove')}
                activeOpacity={0.7}
              >
                <Ionicons name="remove-circle-outline" size={16} color={adjType === 'remove' ? COLORS.white : COLORS.textSecondary} />
                <Text style={[ms.toggleTxt, adjType === 'remove' && ms.toggleTxtActive]}>Remove Stock</Text>
              </TouchableOpacity>
            </View>
            <FormField
              label="Adjustment Quantity"
              value={adjQty}
              onChangeText={setAdjQty}
              keyboardType="numeric"
              placeholder="Enter quantity"
              required
            />
            <ChipSelector
              label="Reason"
              options={ADJ_REASONS.map(r => ({ id: r, label: r }))}
              selected={reason}
              multi={false}
              onSelect={setReason}
            />
            <FormField
              label="Notes"
              value={notes}
              onChangeText={setNotes}
              placeholder="Optional notes..."
              multiline
              numberOfLines={2}
              style={{ minHeight: 60, textAlignVertical: 'top' } as any}
              containerStyle={{ marginBottom: 0 }}
            />
          </ScrollView>
          <View style={ms.btnRow}>
            <TouchableOpacity style={ms.cancelBtn} onPress={() => { reset(); onClose(); }} activeOpacity={0.7}>
              <Text style={ms.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ms.applyBtn} onPress={handleSave} activeOpacity={0.7}>
              <Ionicons name="checkmark-circle" size={16} color={COLORS.white} />
              <Text style={ms.applyTxt}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── STOCK TRANSFER MODAL ─────────────────────────────────────────────────────

function StockTransferModal({
  visible, item, onClose,
}: {
  visible: boolean; item: StockItem | null; onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [toWh, setToWh]   = useState<string[]>([]);
  const [qty, setQty]     = useState('');
  const [notes, setNotes] = useState('');

  const fromWh   = ALL_WAREHOUSES.find(w => w.id === item?.warehouse);
  const toOptions = ALL_WAREHOUSES.filter(w => w.id !== item?.warehouse);

  const reset = () => { setToWh([]); setQty(''); setNotes(''); };

  const handleSave = () => {
    if (!toWh.length) {
      Toast.show({ type: 'error', text1: 'Select Destination', text2: 'Please select a destination warehouse.' });
      return;
    }
    if (!qty.trim()) {
      Toast.show({ type: 'error', text1: 'Enter Quantity', text2: 'Please enter quantity to transfer.' });
      return;
    }
    const toLabel = ALL_WAREHOUSES.find(w => w.id === toWh[0])?.label || toWh[0];
    Toast.show({ type: 'success', text1: 'Transfer Initiated', text2: `${qty} units of ${item?.name} → ${toLabel}` });
    reset(); onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { reset(); onClose(); }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableOpacity style={ms.overlay} activeOpacity={1} onPress={() => { reset(); onClose(); }} />
        <View style={[ms.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={ms.handle} />
          <View style={ms.titleRow}>
            <Text style={ms.title}>Stock Transfer</Text>
            <TouchableOpacity onPress={() => { reset(); onClose(); }} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ms.scroll} keyboardShouldPersistTaps="handled">
            {/* Item info */}
            <View style={ms.readonlyRow}>
              <View style={ms.readonlyIcon}>
                <Ionicons name="cube-outline" size={18} color={COLORS.textPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={ms.readonlyLabel}>Item</Text>
                <Text style={ms.readonlyVal} numberOfLines={1}>{item?.name}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={ms.readonlyLabel}>Available</Text>
                <Text style={[ms.readonlyVal, { color: COLORS.positive }]}>{item?.qty} units</Text>
              </View>
            </View>
            {/* From warehouse (read-only) */}
            <View style={ms.readonlyField}>
              <Text style={ms.readonlyFieldLabel}>From Warehouse</Text>
              <Text style={ms.readonlyFieldVal}>{fromWh?.label ?? item?.warehouse}</Text>
            </View>
            {/* To warehouse */}
            <ChipSelector
              label="To Warehouse *"
              options={toOptions}
              selected={toWh}
              multi={false}
              onSelect={setToWh}
            />
            <FormField
              label="Quantity to Transfer"
              value={qty}
              onChangeText={setQty}
              keyboardType="numeric"
              placeholder="0"
              required
            />
            <FormField
              label="Notes"
              value={notes}
              onChangeText={setNotes}
              placeholder="Optional..."
              multiline
              numberOfLines={2}
              style={{ minHeight: 60, textAlignVertical: 'top' } as any}
              containerStyle={{ marginBottom: 0 }}
            />
          </ScrollView>
          <View style={ms.btnRow}>
            <TouchableOpacity style={ms.cancelBtn} onPress={() => { reset(); onClose(); }} activeOpacity={0.7}>
              <Text style={ms.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ms.applyBtn} onPress={handleSave} activeOpacity={0.7}>
              <Ionicons name="swap-horizontal-outline" size={16} color={COLORS.white} />
              <Text style={ms.applyTxt}>Initiate Transfer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── BULK TRANSFER MODAL ──────────────────────────────────────────────────────

function BulkTransferModal({
  visible, itemCount, onClose,
}: {
  visible: boolean; itemCount: number; onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [fromWh, setFromWh] = useState<string[]>([]);
  const [toWh,   setToWh]   = useState<string[]>([]);
  const [notes,  setNotes]  = useState('');

  const toOptions = ALL_WAREHOUSES.filter(w => !fromWh.includes(w.id));

  const reset = () => { setFromWh([]); setToWh([]); setNotes(''); };

  const handleSave = () => {
    if (!fromWh.length || !toWh.length) {
      Toast.show({ type: 'error', text1: 'Select Warehouses', text2: 'Please select source and destination.' });
      return;
    }
    const toLabel = ALL_WAREHOUSES.find(w => w.id === toWh[0])?.label || toWh[0];
    Toast.show({ type: 'success', text1: 'Bulk Transfer Queued', text2: `${itemCount} items queued → ${toLabel}` });
    reset(); onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { reset(); onClose(); }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableOpacity style={ms.overlay} activeOpacity={1} onPress={() => { reset(); onClose(); }} />
        <View style={[ms.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={ms.handle} />
          <View style={ms.titleRow}>
            <Text style={ms.title}>Bulk Transfer</Text>
            <TouchableOpacity onPress={() => { reset(); onClose(); }} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ms.scroll} keyboardShouldPersistTaps="handled">
            <View style={ms.infoBanner}>
              <Ionicons name="layers-outline" size={20} color={COLORS.brandPrimary} />
              <Text style={ms.infoBannerTxt}>{itemCount} item{itemCount !== 1 ? 's' : ''} selected for bulk transfer</Text>
            </View>
            <ChipSelector
              label="From Warehouse *"
              options={ALL_WAREHOUSES}
              selected={fromWh}
              multi={false}
              onSelect={v => { setFromWh(v); setToWh([]); }}
            />
            <ChipSelector
              label="To Warehouse *"
              options={toOptions}
              selected={toWh}
              multi={false}
              onSelect={setToWh}
            />
            <FormField
              label="Notes"
              value={notes}
              onChangeText={setNotes}
              placeholder="Optional transfer notes..."
              multiline
              numberOfLines={2}
              style={{ minHeight: 60, textAlignVertical: 'top' } as any}
              containerStyle={{ marginBottom: 0 }}
            />
          </ScrollView>
          <View style={ms.btnRow}>
            <TouchableOpacity style={ms.cancelBtn} onPress={() => { reset(); onClose(); }} activeOpacity={0.7}>
              <Text style={ms.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ms.applyBtn} onPress={handleSave} activeOpacity={0.7}>
              <Ionicons name="swap-horizontal-outline" size={16} color={COLORS.white} />
              <Text style={ms.applyTxt}>Queue Transfer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────

export default function TotalStockScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ whId?: string }>();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const whId = params.whId || 'WH01';

  // ── Search & date ──
  const [query,    setQuery]    = useState('');
  const [calOpen,  setCalOpen]  = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');

  // ── Filters ──
  const [filterOpen, setFilterOpen] = useState(false);
  const [selWh,  setSelWh]  = useState<string[]>([]);
  const [selCat, setSelCat] = useState<string[]>([]);
  const [selGrp, setSelGrp] = useState<string[]>([]);

  // ── Multi-select ──
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedIds,     setSelectedIds]     = useState<string[]>([]);

  // ── Modals ──
  const [addItemOpen,      setAddItemOpen]      = useState(false);
  const [editItem,         setEditItem]         = useState<StockItem | null>(null);
  const [transferItem,     setTransferItem]     = useState<StockItem | null>(null);
  const [bulkTransferOpen, setBulkTransferOpen] = useState(false);

  // ── Derived ──
  const filtered = STOCK_ITEMS.filter(item => {
    const q = query.toLowerCase();
    const qMatch  = !query || item.name.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q);
    const whMatch  = selWh.length  === 0 || selWh.includes(item.warehouse);
    const catMatch = selCat.length === 0 || selCat.includes(item.category);
    const grpMatch = selGrp.length === 0 || selGrp.includes(item.group);
    return qMatch && whMatch && catMatch && grpMatch;
  });

  const totalQty         = STOCK_ITEMS.reduce((s, i) => s + i.qty, 0);
  const dateLabel        = dateFrom && dateTo ? `${dateFrom} – ${dateTo}` : 'All Time';
  const activeFilterCount = selWh.length + selCat.length + selGrp.length;
  const allFilteredSelected = filtered.length > 0 && filtered.every(i => selectedIds.includes(i.id));

  // ── Handlers ──
  const handleLongPress = useCallback((id: string) => {
    setMultiSelectMode(true);
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);

  const handleItemPress = useCallback((item: StockItem) => {
    if (multiSelectMode) {
      setSelectedIds(prev =>
        prev.includes(item.id) ? prev.filter(x => x !== item.id) : [...prev, item.id]
      );
    } else {
      router.push(`/stocks/item-detail?id=${item.id}` as any);
    }
  }, [multiSelectMode, router]);

  const exitMultiSelect = useCallback(() => {
    setMultiSelectMode(false);
    setSelectedIds([]);
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(allFilteredSelected ? [] : filtered.map(i => i.id));
  }, [allFilteredSelected, filtered]);

  const handleSharePDF = useCallback(() => {
    if (selectedIds.length === 0) {
      Toast.show({ type: 'error', text1: 'No Items', text2: 'Select at least one item to export.' });
      return;
    }
    Toast.show({ type: 'success', text1: 'PDF Exported', text2: `${selectedIds.length} item${selectedIds.length !== 1 ? 's' : ''} exported as PDF.` });
    exitMultiSelect();
  }, [selectedIds.length, exitMultiSelect]);

  return (
    <SafeAreaView style={styles.safe}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Total Stock</Text>
        <View style={styles.headerRight}>
          {/* Filter icon with badge */}
          <TouchableOpacity style={styles.iconBtn} onPress={() => setFilterOpen(true)} activeOpacity={0.7}>
            <Ionicons name="options-outline" size={20} color={activeFilterCount > 0 ? '#A89060' : COLORS.textPrimary} />
            {activeFilterCount > 0 && (
              <View style={styles.badge}><Text style={styles.badgeTxt}>{activeFilterCount}</Text></View>
            )}
          </TouchableOpacity>
          {/* Calendar icon */}
          <TouchableOpacity style={styles.iconBtn} onPress={() => setCalOpen(true)} activeOpacity={0.7}>
            <Ionicons name="calendar-outline" size={20} color={COLORS.brandPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Multi-select action bar ── */}
      {multiSelectMode && (
        <View style={styles.multiBar}>
          <TouchableOpacity onPress={exitMultiSelect} style={styles.multiCancel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={20} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.multiCount}>{selectedIds.length} selected</Text>
          <View style={styles.multiActions}>
            <TouchableOpacity style={[styles.multiBtn, styles.multiBtnAmber]} onPress={handleSharePDF} activeOpacity={0.8}>
              <Ionicons name="share-outline" size={15} color={COLORS.white} />
              <Text style={styles.multiBtnTxt}>PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.multiBtn, styles.multiBtnGray]}
              onPress={() => { if (selectedIds.length > 0) setBulkTransferOpen(true); }}
              activeOpacity={0.8}
            >
              <Ionicons name="swap-horizontal-outline" size={15} color={COLORS.white} />
              <Text style={styles.multiBtnTxt}>Transfer</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Active filter chips strip ── */}
      {activeFilterCount > 0 && !multiSelectMode && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.activeFiltersRow}
        >
          {selWh.map(w => {
            const found = ALL_WAREHOUSES.find(x => x.id === w);
            return (
              <TouchableOpacity key={w} style={styles.activeChip} onPress={() => setSelWh(p => p.filter(x => x !== w))} activeOpacity={0.7}>
                <Text style={styles.activeChipTxt}>{found?.label.split(' – ')[0] ?? w}</Text>
                <Ionicons name="close" size={11} color="#A89060" />
              </TouchableOpacity>
            );
          })}
          {selCat.map(c => (
            <TouchableOpacity key={c} style={styles.activeChip} onPress={() => setSelCat(p => p.filter(x => x !== c))} activeOpacity={0.7}>
              <Text style={styles.activeChipTxt}>{c}</Text>
              <Ionicons name="close" size={11} color="#A89060" />
            </TouchableOpacity>
          ))}
          {selGrp.map(g => (
            <TouchableOpacity key={g} style={styles.activeChip} onPress={() => setSelGrp(p => p.filter(x => x !== g))} activeOpacity={0.7}>
              <Text style={styles.activeChipTxt}>{g}</Text>
              <Ionicons name="close" size={11} color="#A89060" />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ── Date range strip ── */}
      {(dateFrom || dateTo) && (
        <View style={styles.dateBar}>
          <Ionicons name="calendar-outline" size={13} color="#A89060" />
          <Text style={styles.dateBarTxt}>{dateLabel}</Text>
          <TouchableOpacity onPress={() => { setDateFrom(''); setDateTo(''); }}>
            <Ionicons name="close-circle" size={15} color={COLORS.textTertiary} />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Summary KPI strip ── */}
      <View style={styles.summaryRow}>
        {[
          { label: 'No. of SKUs', value: `${STOCK_ITEMS.length}` },
          { label: 'Total Qty',   value: totalQty.toLocaleString('en-IN') },
          { label: 'Value (INR)', value: '₹83,150' },
        ].map((s, i) => (
          <View key={i} style={styles.summaryItem}>
            <Text style={styles.summaryVal}>{s.value}</Text>
            <Text style={styles.summaryLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* ── Search bar ── */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color={COLORS.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search items..."
          placeholderTextColor={COLORS.textTertiary}
          value={query}
          onChangeText={setQuery}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color={COLORS.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Item list ── */}
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* List header row */}
        <View style={styles.listHeader}>
          <Text style={styles.sectionLabel}>{filtered.length} item{filtered.length !== 1 ? 's' : ''}</Text>
          {multiSelectMode && (
            <TouchableOpacity onPress={toggleSelectAll} activeOpacity={0.7}>
              <Text style={styles.selectAllTxt}>{allFilteredSelected ? 'Deselect All' : 'Select All'}</Text>
            </TouchableOpacity>
          )}
          {!multiSelectMode && (
            <View style={styles.swipeHint}>
              <Ionicons name="swap-horizontal-outline" size={12} color={COLORS.textTertiary} />
              <Text style={styles.swipeHintTxt}>Swipe for actions</Text>
            </View>
          )}
        </View>

        {filtered.map(item => (
          <SwipeableStockCard
            key={item.id}
            item={item}
            isMultiSelectMode={multiSelectMode}
            isSelected={selectedIds.includes(item.id)}
            onPress={() => handleItemPress(item)}
            onLongPress={() => handleLongPress(item.id)}
            onEditStock={() => setEditItem(item)}
            onTransfer={() => setTransferItem(item)}
          />
        ))}

        {filtered.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={40} color={COLORS.textTertiary} />
            <Text style={styles.emptyTxt}>No items match your filters</Text>
            <TouchableOpacity
              onPress={() => { setSelWh([]); setSelCat([]); setSelGrp([]); setQuery(''); }}
              activeOpacity={0.7}
            >
              <Text style={styles.emptyAction}>Clear all filters</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── FAB – Add Item (hidden in multi-select mode) ── */}
      {!multiSelectMode && (
        <TouchableOpacity style={styles.fab} onPress={() => setAddItemOpen(true)} activeOpacity={0.85}>
          <Ionicons name="add" size={28} color={COLORS.white} />
        </TouchableOpacity>
      )}

      {/* ── Modals ── */}
      <FilterModal
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        onApply={(wh, cat, grp) => { setSelWh(wh); setSelCat(cat); setSelGrp(grp); }}
        initWh={selWh} initCat={selCat} initGrp={selGrp}
      />
      <AddItemModal    visible={addItemOpen}     onClose={() => setAddItemOpen(false)} />
      <EditStockModal  visible={!!editItem}       item={editItem}      onClose={() => setEditItem(null)} />
      <StockTransferModal visible={!!transferItem} item={transferItem} onClose={() => setTransferItem(null)} />
      <BulkTransferModal
        visible={bulkTransferOpen}
        itemCount={selectedIds.length}
        onClose={() => { setBulkTransferOpen(false); exitMultiSelect(); }}
      />
      <DateRangePickerModal
        visible={calOpen}
        onClose={() => setCalOpen(false)}
        onApply={(from, to) => { setDateFrom(from); setDateTo(to); }}
      />
    </SafeAreaView>
  );
}

// ─── MAIN SCREEN STYLES ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.pageBg },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn:     { width: 40, alignItems: 'flex-start' },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  headerRight: { width: 80, flexDirection: 'row', justifyContent: 'flex-end', gap: 2 },
  iconBtn:     { position: 'relative', padding: 8 },
  badge:       { position: 'absolute', top: 4, right: 4, width: 15, height: 15, borderRadius: 8, backgroundColor: '#A89060', alignItems: 'center', justifyContent: 'center' },
  badgeTxt:    { fontSize: 8, fontWeight: '800', color: COLORS.white },

  // Multi-select bar
  multiBar:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: SPACING.md, paddingVertical: 12, backgroundColor: '#1A1A1A' },
  multiCancel:  { padding: 2 },
  multiCount:   { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.white },
  multiActions: { flexDirection: 'row', gap: 8 },
  multiBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full },
  multiBtnAmber:{ backgroundColor: '#A89060' },
  multiBtnGray: { backgroundColor: '#444444' },
  multiBtnTxt:  { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.white },

  // Active filter chips
  activeFiltersRow: { paddingHorizontal: SPACING.md, paddingVertical: 8, gap: 8, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  activeChip:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#FBF7EE', borderRadius: RADIUS.full, borderWidth: 1, borderColor: '#F0E8D5' },
  activeChipTxt:    { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: '#A89060' },

  // Date bar
  dateBar:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FBF7EE', paddingHorizontal: SPACING.md, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0E8D5' },
  dateBarTxt: { flex: 1, fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: '#A89060' },

  // Summary KPI strip
  summaryRow:   { flexDirection: 'row', backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, paddingVertical: 12 },
  summaryItem:  { flex: 1, alignItems: 'center' },
  summaryVal:   { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary },
  summaryLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },

  // Search bar
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: SPACING.md, marginTop: 12, marginBottom: 4,
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: 10,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  searchInput: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, padding: 0 },

  // List
  scroll:       { flex: 1 },
  content:      { padding: SPACING.md, gap: 8 },
  listHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  sectionLabel: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textTertiary },
  selectAllTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: '#A89060' },
  swipeHint:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  swipeHintTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },

  // Empty state
  emptyState:   { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyTxt:     { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textTertiary },
  emptyAction:  { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: '#A89060', textDecorationLine: 'underline' },

  // FAB
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: COLORS.brandPrimary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 10, elevation: 8,
  },
});
