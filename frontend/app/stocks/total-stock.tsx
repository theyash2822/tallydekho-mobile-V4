import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput,
  Modal, Animated, KeyboardAvoidingView, Platform, ActivityIndicator, Switch,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type StockItem = {
  id: string; name: string; sku: string; category: string;
  group: string; warehouse: string; qty: number; value: string;
  icon: string; iconColor: string; iconBg: string;
};

type BtnPhase = 'idle' | 'loading' | 'success';

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

const ALL_WAREHOUSES  = [{ id: 'WH01', label: 'WH01 – Mumbai' }, { id: 'WH02', label: 'WH02 – Delhi' }, { id: 'WH03', label: 'WH03 – Bangalore' }, { id: 'WH04', label: 'WH04 – Hyderabad' }];
const ALL_CATEGORIES  = ['Audio', 'Accessories', 'Peripherals', 'Furniture', 'Mobiles', 'Electronics'];
const ALL_GROUPS      = ['Consumer Electronics', 'Mobile Accessories', 'Office Peripherals', 'Office Supplies'];
const ALL_UNITS       = [{ id: 'pcs', label: 'pcs' }, { id: 'kg', label: 'kg' }, { id: 'box', label: 'box' }, { id: 'set', label: 'set' }, { id: 'litre', label: 'litre' }];
const ALL_TAX_RATES   = [{ id: 'none', label: 'None (0%)' }, { id: '5', label: '5%' }, { id: '12', label: '12%' }, { id: '18', label: '18%' }, { id: '28', label: '28%' }];
const RACK_OPTIONS    = [{ id: 'A-07', label: 'Rack A-07' }, { id: 'B-12', label: 'Rack B-12' }, { id: 'C-01', label: 'Rack C-01' }, { id: 'D-05', label: 'Rack D-05' }];
const ADJ_REASONS     = [{ id: 'damage', label: 'Damage' }, { id: 'theft', label: 'Theft' }, { id: 'count', label: 'Count Correction' }, { id: 'opening', label: 'Opening Balance' }, { id: 'other', label: 'Other' }];
const LOW_STOCK_QTY   = 30;

// ─── CHIP SELECTOR ────────────────────────────────────────────────────────────

function ChipSelector({ label, options, selected, multi = true, onSelect }: {
  label: string; options: { id: string; label: string }[];
  selected: string[]; multi?: boolean; onSelect: (ids: string[]) => void;
}) {
  const toggle = (id: string) => {
    if (multi) { onSelect(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]); }
    else { onSelect(selected.includes(id) ? [] : [id]); }
  };
  return (
    <View style={chip.wrap}>
      <Text style={chip.label}>{label}</Text>
      <View style={chip.row}>
        {options.map(opt => (
          <TouchableOpacity key={opt.id} style={[chip.item, selected.includes(opt.id) && chip.itemActive]} onPress={() => toggle(opt.id)} activeOpacity={0.7}>
            <Text style={[chip.text, selected.includes(opt.id) && chip.textActive]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
const chip = StyleSheet.create({
  wrap: { marginBottom: SPACING.md },
  label: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  item: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.full, borderWidth: 1.5, borderColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg },
  itemActive: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  text: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  textActive: { color: COLORS.white },
});

// ─── QTY STEPPER FIELD ────────────────────────────────────────────────────────

function QtyStepperField({ label, subLabel, value, onChange }: {
  label?: string; subLabel?: string; value: number; onChange: (v: number) => void;
}) {
  return (
    <View style={qs.wrap}>
      {label ? <Text style={qs.label}>{label}{subLabel ? <Text style={qs.sub}> {subLabel}</Text> : null}</Text> : null}
      <View style={qs.row}>
        <TouchableOpacity style={qs.btn} onPress={() => onChange(Math.max(0, value - 1))} activeOpacity={0.7}>
          <Ionicons name="remove" size={18} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={qs.val}>{value}</Text>
        <TouchableOpacity style={qs.btn} onPress={() => onChange(value + 1)} activeOpacity={0.7}>
          <Ionicons name="add" size={18} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
const qs = StyleSheet.create({
  wrap:  { flex: 1 },
  label: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  sub:   { fontSize: TYPOGRAPHY.xs, fontWeight: '400', color: COLORS.negative },
  row:   { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, minHeight: 48 },
  btn:   { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
  val:   { flex: 1, textAlign: 'center', fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
});

// ─── ANIMATED SUBMIT BUTTON ───────────────────────────────────────────────────

function SubmitButton({ idleLabel, loadingLabel, successLabel, onValidate, onDone }: {
  idleLabel: string; loadingLabel: string; successLabel: string;
  onValidate: () => boolean; onDone: () => void;
}) {
  const [phase, setPhase] = useState<BtnPhase>('idle');
  const handlePress = () => {
    if (phase !== 'idle') return;
    if (!onValidate()) return;
    setPhase('loading');
    setTimeout(() => {
      setPhase('success');
      setTimeout(() => { onDone(); setPhase('idle'); }, 900);
    }, 1300);
  };
  return (
    <TouchableOpacity
      style={[sb.btn, phase === 'success' && sb.btnSuccess, phase === 'loading' && sb.btnLoading]}
      onPress={handlePress} disabled={phase !== 'idle'} activeOpacity={0.85}
    >
      {phase === 'loading' && <ActivityIndicator size="small" color={COLORS.white} style={{ marginRight: 6 }} />}
      {phase === 'success' && <Ionicons name="checkmark-circle" size={18} color={COLORS.white} style={{ marginRight: 6 }} />}
      <Text style={sb.txt}>{phase === 'idle' ? idleLabel : phase === 'loading' ? loadingLabel : successLabel}</Text>
    </TouchableOpacity>
  );
}
const sb = StyleSheet.create({
  btn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary },
  btnLoading: { opacity: 0.72 },
  btnSuccess: { backgroundColor: COLORS.positive },
  txt:        { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});

// ─── ITEM HEADER CARD (top of modals) ────────────────────────────────────────

function ItemHeaderCard({ item }: { item: StockItem }) {
  const isLow = item.qty < LOW_STOCK_QTY;
  return (
    <View style={ih.card}>
      <View style={ih.icon}><Ionicons name="cube-outline" size={20} color={COLORS.textPrimary} /></View>
      <View style={ih.info}>
        <Text style={ih.name} numberOfLines={1}>{item.name}</Text>
        <Text style={ih.sku}>{item.sku}</Text>
      </View>
      {isLow && (
        <View style={ih.lowBadge}>
          <Ionicons name="warning-outline" size={11} color={COLORS.warning} />
          <Text style={ih.lowTxt}>Low stock</Text>
        </View>
      )}
      <View style={ih.stockBadge}>
        <Text style={ih.stockNum}>{item.qty}</Text>
        <Text style={ih.stockLbl}> Stock</Text>
      </View>
    </View>
  );
}
const ih = StyleSheet.create({
  card:      { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  icon:      { width: 38, height: 38, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8E7E1' },
  info:      { flex: 1 },
  name:      { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  sku:       { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 1 },
  lowBadge:  { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: COLORS.warningBg, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  lowTxt:    { fontSize: 10, fontWeight: '700', color: COLORS.warning },
  stockBadge:{ flexDirection: 'row', alignItems: 'baseline' },
  stockNum:  { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary },
  stockLbl:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
});

// ─── READ-ONLY FIELD ──────────────────────────────────────────────────────────

function ReadonlyField({ label, value, icon }: { label: string; value: string; icon?: string }) {
  return (
    <View style={rf.wrap}>
      <Text style={rf.label}>{label}</Text>
      <View style={rf.field}>
        {icon ? <Ionicons name={icon as any} size={15} color={COLORS.textTertiary} style={{ marginRight: 6 }} /> : null}
        <Text style={rf.value}>{value}</Text>
      </View>
    </View>
  );
}
const rf = StyleSheet.create({
  wrap:  { flex: 1, marginBottom: SPACING.md },
  label: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  field: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, minHeight: 48 },
  value: { flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textSecondary },
});

// ─── INLINE FIELD ─────────────────────────────────────────────────────────────

function InlineField({ label, value, onChange, placeholder, keyboardType, multiline, required }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
  keyboardType?: any; multiline?: boolean; required?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={inf.wrap}>
      <Text style={inf.label}>{label}{required ? <Text style={inf.star}> *</Text> : null}</Text>
      <TextInput
        style={[inf.input, focused && inf.focused, multiline && { minHeight: 64, textAlignVertical: 'top' }]}
        value={value} onChangeText={onChange} placeholder={placeholder ?? '—'}
        placeholderTextColor={COLORS.textTertiary} keyboardType={keyboardType}
        multiline={multiline} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      />
    </View>
  );
}
const inf = StyleSheet.create({
  wrap:    { flex: 1, marginBottom: SPACING.md },
  label:   { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  star:    { color: COLORS.negative },
  input:   { backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, minHeight: 48 },
  focused: { borderColor: COLORS.brandPrimary, borderWidth: 1.5 },
});

// ─── INLINE CURRENCY FIELD ────────────────────────────────────────────────────

function CurrencyField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={cf.wrap}>
      <Text style={cf.label}>{label}</Text>
      <View style={[cf.row, focused && cf.rowFocused]}>
        <TextInput
          style={cf.input} value={value} onChangeText={onChange}
          placeholder={placeholder ?? '0.00'} placeholderTextColor={COLORS.textTertiary}
          keyboardType="decimal-pad"
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        />
        <View style={cf.badge}><Text style={cf.badgeTxt}>INR</Text></View>
      </View>
    </View>
  );
}
const cf = StyleSheet.create({
  wrap:       { flex: 1, marginBottom: SPACING.md },
  label:      { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  row:        { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, minHeight: 48, overflow: 'hidden' },
  rowFocused: { borderColor: COLORS.brandPrimary, borderWidth: 1.5 },
  input:      { flex: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  badge:      { paddingHorizontal: 12, paddingVertical: 4, backgroundColor: COLORS.pageBg, borderLeftWidth: 1, borderLeftColor: COLORS.borderDefault, height: '100%', justifyContent: 'center' },
  badgeTxt:   { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textTertiary },
});

// ─── MODAL SHARED STYLES ──────────────────────────────────────────────────────

const ms = StyleSheet.create({
  overlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.48)' },
  sheet:    { backgroundColor: COLORS.cardBg, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '92%', paddingTop: 10 },
  handle:   { width: 40, height: 4, backgroundColor: COLORS.borderStrong, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  title:    { fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  scroll:   { padding: SPACING.md },
  footer:   { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.borderDefault, marginBottom: 4 },
  row:      { flexDirection: 'row', gap: 10, marginBottom: SPACING.md },
  divider:  { height: 1, backgroundColor: COLORS.borderDefault, marginVertical: 12 },
  sectionLbl:{ fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  infoBanner:{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#E8E7E1', borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.md },
  infoBannerTxt: { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  clearTxt:  { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: '#A89060' },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.borderDefault, alignItems: 'center', justifyContent: 'center' },
  cancelTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textSecondary },
  applyBtn:  { flex: 2, flexDirection: 'row', gap: 8, paddingVertical: 14, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  applyTxt:  { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
  btnRow:    { flexDirection: 'row', gap: 12, marginBottom: 4 },
});

// ─── SWIPEABLE STOCK CARD ─────────────────────────────────────────────────────

const sw = StyleSheet.create({
  actionWrap: { width: 88, justifyContent: 'center', alignItems: 'center', borderRadius: RADIUS.md, overflow: 'hidden' },
  transferBg: { backgroundColor: COLORS.brandPrimary },
  editBg:     { backgroundColor: '#A89060' },
  actionInner:{ flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center', gap: 5 },
  actionTxt:  { fontSize: 11, fontWeight: '700', color: COLORS.white },
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

function SwipeableStockCard({ item, isMultiSelectMode, isSelected, onPress, onLongPress, onEditStock, onTransfer }: {
  item: StockItem; isMultiSelectMode: boolean; isSelected: boolean;
  onPress: () => void; onLongPress: () => void; onEditStock: () => void; onTransfer: () => void;
}) {
  const swipeRef = useRef<any>(null);
  const renderLeftActions = (_: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
    const scale = dragX.interpolate({ inputRange: [0, 80], outputRange: [0.85, 1], extrapolate: 'clamp' });
    return (
      <Animated.View style={[sw.actionWrap, sw.transferBg, { transform: [{ scale }] }]}>
        <TouchableOpacity style={sw.actionInner} onPress={() => { swipeRef.current?.close(); onTransfer(); }} activeOpacity={0.85}>
          <Ionicons name="swap-horizontal-outline" size={22} color={COLORS.white} />
          <Text style={sw.actionTxt}>Transfer</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };
  const renderRightActions = (_: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
    const scale = dragX.interpolate({ inputRange: [-80, 0], outputRange: [1, 0.85], extrapolate: 'clamp' });
    return (
      <Animated.View style={[sw.actionWrap, sw.editBg, { transform: [{ scale }] }]}>
        <TouchableOpacity style={sw.actionInner} onPress={() => { swipeRef.current?.close(); onEditStock(); }} activeOpacity={0.85}>
          <Ionicons name="create-outline" size={22} color={COLORS.white} />
          <Text style={sw.actionTxt}>Edit Stock</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };
  const cardInner = (
    <TouchableOpacity style={[sc.card, isSelected && sc.cardSelected]} onPress={onPress} onLongPress={onLongPress} activeOpacity={0.85} delayLongPress={380}>
      {isMultiSelectMode ? (
        <View style={[sc.checkbox, isSelected && sc.checkboxActive]}>
          {isSelected && <Ionicons name="checkmark" size={12} color={COLORS.white} />}
        </View>
      ) : null}
      <View style={sc.icon}><Ionicons name="cube-outline" size={20} color={COLORS.textPrimary} /></View>
      <View style={sc.info}>
        <Text style={sc.name} numberOfLines={1}>{item.name}</Text>
        <Text style={sc.sku}>{item.sku} · {item.category}</Text>
      </View>
      <View style={sc.right}>
        <Text style={sc.value}>{item.value}</Text>
        <View style={sc.qtyBadge}><Text style={sc.qtyTxt}>{item.qty} units</Text></View>
      </View>
      {!isMultiSelectMode && <Ionicons name="chevron-forward" size={14} color={COLORS.textTertiary} style={{ marginLeft: 4 }} />}
    </TouchableOpacity>
  );
  if (isMultiSelectMode) return cardInner;
  return (
    <Swipeable ref={swipeRef} renderLeftActions={renderLeftActions} renderRightActions={renderRightActions} friction={2} leftThreshold={40} rightThreshold={40} overshootLeft={false} overshootRight={false}>
      {cardInner}
    </Swipeable>
  );
}

// ─── FILTER MODAL ─────────────────────────────────────────────────────────────

function FilterModal({ visible, onClose, onApply, initWh, initCat, initGrp }: {
  visible: boolean; onClose: () => void;
  onApply: (wh: string[], cat: string[], grp: string[]) => void;
  initWh: string[]; initCat: string[]; initGrp: string[];
}) {
  const insets = useSafeAreaInsets();
  const [selWh, setSelWh]   = useState<string[]>(initWh);
  const [selCat, setSelCat] = useState<string[]>(initCat);
  const [selGrp, setSelGrp] = useState<string[]>(initGrp);
  useEffect(() => { if (visible) { setSelWh(initWh); setSelCat(initCat); setSelGrp(initGrp); } }, [visible]);
  const total = selWh.length + selCat.length + selGrp.length;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={ms.overlay} activeOpacity={1} onPress={onClose} />
      <View style={[ms.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={ms.handle} />
        <View style={ms.titleRow}>
          <Text style={ms.title}>Filter Items</Text>
          <TouchableOpacity onPress={() => { setSelWh([]); setSelCat([]); setSelGrp([]); }} activeOpacity={0.7}>
            <Text style={ms.clearTxt}>{total > 0 ? `Clear All (${total})` : 'Clear All'}</Text>
          </TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ms.scroll}>
          <ChipSelector label="Warehouse" options={ALL_WAREHOUSES} selected={selWh} multi onSelect={setSelWh} />
          <ChipSelector label="Category" options={ALL_CATEGORIES.map(c => ({ id: c, label: c }))} selected={selCat} multi onSelect={setSelCat} />
          <ChipSelector label="Item Group" options={ALL_GROUPS.map(g => ({ id: g, label: g }))} selected={selGrp} multi onSelect={setSelGrp} />
        </ScrollView>
        <View style={[ms.footer, ms.btnRow]}>
          <TouchableOpacity style={ms.cancelBtn} onPress={onClose} activeOpacity={0.7}><Text style={ms.cancelTxt}>Cancel</Text></TouchableOpacity>
          <TouchableOpacity style={ms.applyBtn} onPress={() => { onApply(selWh, selCat, selGrp); onClose(); }} activeOpacity={0.7}>
            <Ionicons name="checkmark-circle" size={16} color={COLORS.white} />
            <Text style={ms.applyTxt}>Apply Filters</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── ADD NEW ITEM MODAL ───────────────────────────────────────────────────────

function AddItemModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [group,       setGroup]       = useState<string[]>([]);
  const [name,        setName]        = useState('');
  const [unit,        setUnit]        = useState<string[]>([]);
  const [taxRate,     setTaxRate]     = useState<string[]>([]);
  const [purchPrice,  setPurchPrice]  = useState('');
  const [warehouse,   setWarehouse]   = useState<string[]>(['WH01']);
  const [qty,         setQty]         = useState('');
  const [salePrice,   setSalePrice]   = useState('');
  const [expiryDate,  setExpiryDate]  = useState('');
  const [batchNo,     setBatchNo]     = useState('');
  const [genBarcode,  setGenBarcode]  = useState(true);
  const [barcodeFields, setBarcodeFields] = useState({ itemName: true, sku: false, salePrice: false });

  const reset = () => {
    setGroup([]); setName(''); setUnit([]); setTaxRate([]); setPurchPrice('');
    setWarehouse(['WH01']); setQty(''); setSalePrice(''); setExpiryDate('');
    setBatchNo(''); setGenBarcode(true); setBarcodeFields({ itemName: true, sku: false, salePrice: false });
  };

  const validate = () => {
    if (!name.trim()) { Toast.show({ type: 'error', text1: 'Required', text2: 'Product name is required.' }); return false; }
    if (unit.length === 0) { Toast.show({ type: 'error', text1: 'Required', text2: 'Select a unit of measure.' }); return false; }
    return true;
  };

  const handleDone = () => {
    Toast.show({ type: 'success', text1: 'Item Saved', text2: `"${name}" added to inventory.` });
    reset(); onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { reset(); onClose(); }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableOpacity style={ms.overlay} activeOpacity={1} onPress={() => { reset(); onClose(); }} />
        <View style={[ms.sheet, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <View style={ms.handle} />
          <View style={ms.titleRow}>
            <Text style={ms.title}>Add New Item</Text>
            <TouchableOpacity onPress={() => { reset(); onClose(); }} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ms.scroll} keyboardShouldPersistTaps="handled">
            {/* Group */}
            <ChipSelector label="Group" options={ALL_GROUPS.map(g => ({ id: g, label: g }))} selected={group} multi={false} onSelect={setGroup} />
            {/* Product Name */}
            <InlineField label="Product name" value={name} onChange={setName} placeholder="Enter product name" required />
            {/* Unit + Tax Rate */}
            <View style={ms.row}>
              <View style={{ flex: 1 }}>
                <ChipSelector label="Unit of measure *" options={ALL_UNITS} selected={unit} multi={false} onSelect={setUnit} />
              </View>
              <View style={{ flex: 1 }}>
                <ChipSelector label="Tax rate" options={ALL_TAX_RATES} selected={taxRate} multi={false} onSelect={setTaxRate} />
              </View>
            </View>
            {/* Purchase Price */}
            <CurrencyField label="Purchase Price" value={purchPrice} onChange={setPurchPrice} placeholder="₹ 0.00" />
            {/* Warehouse */}
            <ChipSelector label="Warehouse Placement" options={ALL_WAREHOUSES} selected={warehouse} multi={false} onSelect={setWarehouse} />
            {/* Qty + Default Sale Price */}
            <View style={ms.row}>
              <InlineField label="Quantity" value={qty} onChange={setQty} placeholder="—" keyboardType="numeric" />
              <CurrencyField label="Default Sale Price" value={salePrice} onChange={setSalePrice} placeholder="₹ —" />
            </View>
            {/* Expiry Date + Batch Number */}
            <View style={ms.row}>
              <InlineField label="Expiry Date" value={expiryDate} onChange={setExpiryDate} placeholder="DD/MM/YYYY" />
              <InlineField label="Batch Number" value={batchNo} onChange={setBatchNo} placeholder="Enter batch no." />
            </View>
            {/* Generate Barcode toggle */}
            <View style={ai.switchRow}>
              <Switch
                value={genBarcode} onValueChange={setGenBarcode}
                trackColor={{ false: COLORS.borderDefault, true: COLORS.brandPrimary }}
                thumbColor={COLORS.white}
              />
              <Text style={ai.switchTxt}>Generate Barcode</Text>
            </View>
            {/* Barcode field checkboxes */}
            {genBarcode && (
              <View style={ai.checkRow}>
                {([['itemName', 'Item Name'], ['sku', 'SKU'], ['salePrice', 'Sale Price']] as const).map(([k, l]) => (
                  <TouchableOpacity key={k} style={ai.checkItem} onPress={() => setBarcodeFields(p => ({ ...p, [k]: !p[k] }))} activeOpacity={0.7}>
                    <View style={[ai.checkbox, barcodeFields[k as keyof typeof barcodeFields] && ai.checkboxActive]}>
                      {barcodeFields[k as keyof typeof barcodeFields] && <Ionicons name="checkmark" size={12} color={COLORS.white} />}
                    </View>
                    <Text style={ai.checkTxt}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>
          <View style={ms.footer}>
            <SubmitButton idleLabel="Save" loadingLabel="Saving..." successLabel="✓ Saved" onValidate={validate} onDone={handleDone} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const ai = StyleSheet.create({
  switchRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: SPACING.md },
  switchTxt:    { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textPrimary },
  checkRow:     { flexDirection: 'row', gap: 16, marginBottom: SPACING.md },
  checkItem:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkbox:     { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: COLORS.borderStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.cardBg },
  checkboxActive:{ backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  checkTxt:     { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
});

// ─── EDIT STOCK MODAL ─────────────────────────────────────────────────────────

function EditStockModal({ visible, item, onClose }: { visible: boolean; item: StockItem | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [binRack,    setBinRack]    = useState('Rack A-07');
  const [batchSerial,setBatchSerial]= useState('SN2024-01');
  const [adjQty,     setAdjQty]     = useState(0);
  const [adjReason,  setAdjReason]  = useState<string[]>([]);
  const [refNote,    setRefNote]    = useState('');
  const reset = () => { setBinRack('Rack A-07'); setBatchSerial('SN2024-01'); setAdjQty(0); setAdjReason([]); setRefNote(''); };
  const validate = () => {
    if (adjQty === 0) { Toast.show({ type: 'error', text1: 'Required', text2: 'Adjustment quantity must be > 0.' }); return false; }
    if (adjReason.length === 0) { Toast.show({ type: 'error', text1: 'Required', text2: 'Select an adjustment reason.' }); return false; }
    return true;
  };
  const handleDone = () => {
    Toast.show({ type: 'success', text1: 'Adjustment Saved', text2: `${item?.name} adjusted by ${adjQty} units.` });
    reset(); onClose();
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { reset(); onClose(); }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableOpacity style={ms.overlay} activeOpacity={1} onPress={() => { reset(); onClose(); }} />
        <View style={[ms.sheet, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <View style={ms.handle} />
          <View style={ms.titleRow}>
            <Text style={ms.title}>Edit Stock</Text>
            <TouchableOpacity onPress={() => { reset(); onClose(); }} activeOpacity={0.7}><Ionicons name="close" size={22} color={COLORS.textSecondary} /></TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ms.scroll} keyboardShouldPersistTaps="handled">
            {item && <ItemHeaderCard item={item} />}
            {/* Warehouse (read-only) */}
            <ReadonlyField label="Warehouse" value={ALL_WAREHOUSES.find(w => w.id === item?.warehouse)?.label ?? item?.warehouse ?? ''} icon="home-outline" />
            {/* Bin/Rack + Batch/Serial */}
            <View style={ms.row}>
              <InlineField label="Bin / Rack" value={binRack} onChange={setBinRack} placeholder="Rack A-07" />
              <InlineField label="Batch / Serial Picker" value={batchSerial} onChange={setBatchSerial} placeholder="SN2024-01" />
            </View>
            {/* Current On-hand Qty */}
            <ReadonlyField label="Current On-hand Qty" value={item ? String(item.qty) : '—'} />
            {/* Adjustment Qty + Reason */}
            <View style={ms.row}>
              <QtyStepperField label="Adjustment Quantity" subLabel="(required)" value={adjQty} onChange={setAdjQty} />
              <View style={{ flex: 1 }}>
                <ChipSelector label="Adjustment Reason (required)" options={ADJ_REASONS} selected={adjReason} multi={false} onSelect={setAdjReason} />
              </View>
            </View>
            {/* Reference / Note */}
            <InlineField label="Reference / Note" value={refNote} onChange={setRefNote} placeholder="—" multiline />
          </ScrollView>
          <View style={ms.footer}>
            <SubmitButton idleLabel="Save Adjustment" loadingLabel="Saving..." successLabel="✓ Adjustment Done" onValidate={validate} onDone={handleDone} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── STOCK TRANSFER MODAL ─────────────────────────────────────────────────────

function StockTransferModal({ visible, item, onClose }: { visible: boolean; item: StockItem | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [sourceWh,   setSourceWh]   = useState<string[]>(item ? [item.warehouse] : []);
  const [sourceRack, setSourceRack] = useState<string[]>([]);
  const [batchSerial,setBatchSerial]= useState('SN2024-01');
  const [destWh,     setDestWh]     = useState<string[]>([]);
  const [destRack,   setDestRack]   = useState('');
  const [transferQty,setTransferQty]= useState(1);
  const [narration,  setNarration]  = useState('');
  const destOptions = ALL_WAREHOUSES.filter(w => !sourceWh.includes(w.id));
  useEffect(() => { if (visible && item) setSourceWh([item.warehouse]); }, [visible, item?.id]);
  const reset = () => { setSourceRack([]); setBatchSerial('SN2024-01'); setDestWh([]); setDestRack(''); setTransferQty(1); setNarration(''); };
  const validate = () => {
    if (destWh.length === 0) { Toast.show({ type: 'error', text1: 'Required', text2: 'Select destination warehouse.' }); return false; }
    if (transferQty === 0) { Toast.show({ type: 'error', text1: 'Required', text2: 'Quantity to transfer must be > 0.' }); return false; }
    return true;
  };
  const handleDone = () => {
    const toLabel = ALL_WAREHOUSES.find(w => w.id === destWh[0])?.label ?? destWh[0];
    Toast.show({ type: 'success', text1: 'Transfer Initiated', text2: `${transferQty} units of ${item?.name} → ${toLabel}` });
    reset(); onClose();
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { reset(); onClose(); }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableOpacity style={ms.overlay} activeOpacity={1} onPress={() => { reset(); onClose(); }} />
        <View style={[ms.sheet, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <View style={ms.handle} />
          <View style={ms.titleRow}>
            <Text style={ms.title}>Stock Transfer</Text>
            <TouchableOpacity onPress={() => { reset(); onClose(); }} activeOpacity={0.7}><Ionicons name="close" size={22} color={COLORS.textSecondary} /></TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ms.scroll} keyboardShouldPersistTaps="handled">
            {item && <ItemHeaderCard item={item} />}
            {/* Source Warehouse */}
            <ChipSelector label="Source Warehouse" options={ALL_WAREHOUSES} selected={sourceWh} multi={false} onSelect={v => { setSourceWh(v); setDestWh([]); }} />
            {/* Source Rack */}
            <ChipSelector label="Source Rack" options={RACK_OPTIONS} selected={sourceRack} multi={false} onSelect={setSourceRack} />
            {/* On-hand Qty + Batch/Serial */}
            <View style={ms.row}>
              <ReadonlyField label="On-hand Qty" value={item ? String(item.qty) : '—'} />
              <InlineField label="Batch / Serial Picker" value={batchSerial} onChange={setBatchSerial} placeholder="SN2024-01" />
            </View>
            {/* Destination Warehouse */}
            <ChipSelector label="Destination Warehouse  *required" options={destOptions} selected={destWh} multi={false} onSelect={setDestWh} />
            {/* Destination Rack + Qty */}
            <View style={ms.row}>
              <InlineField label="Destination Rack" value={destRack} onChange={setDestRack} placeholder="Rack A-07" />
              <QtyStepperField label="Quantity to Transfer" subLabel="(required)" value={transferQty} onChange={setTransferQty} />
            </View>
            {/* Narration */}
            <InlineField label="Narration" value={narration} onChange={setNarration} placeholder="—" multiline />
          </ScrollView>
          <View style={ms.footer}>
            <SubmitButton idleLabel="Transfer" loadingLabel="Transferring..." successLabel="✓ Transferred" onValidate={validate} onDone={handleDone} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── BULK TRANSFER MODAL ──────────────────────────────────────────────────────

type TransferRow = { item: StockItem; qty: number; batchSerial: string };

function BulkTransferModal({ visible, preselectedItems, onClose }: {
  visible: boolean; preselectedItems: StockItem[]; onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [rows,       setRows]       = useState<TransferRow[]>([]);
  const [search,     setSearch]     = useState('');
  const [sourceWh,   setSourceWh]   = useState<string[]>([]);
  const [sourceRack, setSourceRack] = useState('');
  const [destWh,     setDestWh]     = useState<string[]>([]);
  const [destRack,   setDestRack]   = useState('');
  const [narration,  setNarration]  = useState('');

  useEffect(() => {
    if (visible) {
      setRows(preselectedItems.map(i => ({ item: i, qty: 1, batchSerial: 'SN2024-01' })));
      setSearch(''); setSourceWh([]); setSourceRack(''); setDestWh([]); setDestRack(''); setNarration('');
    }
  }, [visible]);

  const destOptions = ALL_WAREHOUSES.filter(w => !sourceWh.includes(w.id));
  const searchResults = search.trim()
    ? STOCK_ITEMS.filter(i => (i.name.toLowerCase().includes(search.toLowerCase()) || i.sku.toLowerCase().includes(search.toLowerCase())) && !rows.find(r => r.item.id === i.id)).slice(0, 4)
    : [];

  const addItem    = (item: StockItem) => { setRows(p => [...p, { item, qty: 1, batchSerial: '' }]); setSearch(''); };
  const removeItem = (id: string)      => setRows(p => p.filter(r => r.item.id !== id));
  const updQty     = (id: string, q: number) => setRows(p => p.map(r => r.item.id === id ? { ...r, qty: q } : r));
  const updBatch   = (id: string, b: string) => setRows(p => p.map(r => r.item.id === id ? { ...r, batchSerial: b } : r));

  const validate = () => {
    if (rows.length === 0) { Toast.show({ type: 'error', text1: 'No Items', text2: 'Add at least one item.' }); return false; }
    if (destWh.length === 0) { Toast.show({ type: 'error', text1: 'Required', text2: 'Select destination warehouse.' }); return false; }
    return true;
  };
  const handleDone = () => {
    const toLabel = ALL_WAREHOUSES.find(w => w.id === destWh[0])?.label ?? destWh[0];
    Toast.show({ type: 'success', text1: 'Bulk Transfer Initiated', text2: `${rows.length} item${rows.length !== 1 ? 's' : ''} → ${toLabel}` });
    onClose();
  };

  // Pill display: show first 2 items, "+N" for rest
  const shownPills = rows.slice(0, 2);
  const extraCount = rows.length - 2;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableOpacity style={ms.overlay} activeOpacity={1} onPress={onClose} />
        <View style={[ms.sheet, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <View style={ms.handle} />
          <View style={ms.titleRow}>
            <Text style={ms.title}>Bulk Transfer</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}><Ionicons name="close" size={22} color={COLORS.textSecondary} /></TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ms.scroll} keyboardShouldPersistTaps="handled">
            {/* ── Item Name (SKU) pill row ── */}
            <View style={bt.pillSection}>
              <Text style={ms.sectionLbl}>Item Name (SKU)</Text>
              <View style={bt.pillRow}>
                {shownPills.map(r => (
                  <View key={r.item.id} style={bt.pill}>
                    <Text style={bt.pillTxt} numberOfLines={1}>{r.item.name} ({r.item.sku})</Text>
                    <TouchableOpacity onPress={() => removeItem(r.item.id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                      <Ionicons name="close" size={13} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ))}
                {extraCount > 0 && (
                  <View style={bt.pillExtra}>
                    <Text style={bt.pillExtraTxt}>+{extraCount} ›</Text>
                  </View>
                )}
                {rows.length === 0 && <Text style={bt.emptyPill}>No items selected</Text>}
              </View>
              {/* Search to add items */}
              <View style={bt.searchWrap}>
                <Ionicons name="search-outline" size={14} color={COLORS.textTertiary} />
                <TextInput style={bt.searchInput} value={search} onChangeText={setSearch} placeholder="Search & add items..." placeholderTextColor={COLORS.textTertiary} />
                {search.length > 0 && <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={15} color={COLORS.textTertiary} /></TouchableOpacity>}
              </View>
              {searchResults.length > 0 && (
                <View style={bt.results}>
                  {searchResults.map(i => (
                    <TouchableOpacity key={i.id} style={bt.resultItem} onPress={() => addItem(i)} activeOpacity={0.7}>
                      <View style={bt.resultIcon}><Ionicons name="cube-outline" size={14} color={COLORS.textPrimary} /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={bt.resultName} numberOfLines={1}>{i.name}</Text>
                        <Text style={bt.resultSku}>{i.sku}</Text>
                      </View>
                      <Ionicons name="add-circle-outline" size={18} color={COLORS.brandPrimary} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* ── Source Warehouse ── */}
            <ChipSelector label="Source Warehouse" options={ALL_WAREHOUSES} selected={sourceWh} multi={false} onSelect={v => { setSourceWh(v); setDestWh([]); }} />
            {/* ── Source Rack ── */}
            <InlineField label="Source Rack" value={sourceRack} onChange={setSourceRack} placeholder="Search Rack" />

            {/* ── Per-item rows ── */}
            {rows.length > 0 && (
              <View>
                <View style={ms.divider} />
                {rows.map(r => (
                  <View key={r.item.id} style={bt.itemCard}>
                    <View style={bt.itemHeader}>
                      <View style={bt.itemIcon}><Ionicons name="cube-outline" size={16} color={COLORS.textPrimary} /></View>
                      <Text style={bt.itemName} numberOfLines={1}>{r.item.name}</Text>
                    </View>
                    <View style={ms.row}>
                      <ReadonlyField label="On-hand Qty" value={String(r.item.qty)} />
                      <InlineField label="Batch / Serial Picker" value={r.batchSerial} onChange={v => updBatch(r.item.id, v)} placeholder="SN2024-01" />
                    </View>
                    <QtyStepperField label="Quantity to Transfer" subLabel="**required" value={r.qty} onChange={q => updQty(r.item.id, q)} />
                  </View>
                ))}
                <View style={ms.divider} />
              </View>
            )}

            {/* ── Destination ── */}
            <ChipSelector label="Destination Warehouse  *required" options={destOptions} selected={destWh} multi={false} onSelect={setDestWh} />
            <InlineField label="Destination Rack" value={destRack} onChange={setDestRack} placeholder="Search Rack" />
            <InlineField label="Narration" value={narration} onChange={setNarration} placeholder="—" multiline />
          </ScrollView>
          <View style={ms.footer}>
            <SubmitButton idleLabel="Transfer" loadingLabel="Transferring..." successLabel="✓ Transferred" onValidate={validate} onDone={handleDone} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const bt = StyleSheet.create({
  pillSection: { marginBottom: SPACING.md },
  pillRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  pill:        { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#E8E7E1', borderRadius: RADIUS.full, maxWidth: 200 },
  pillTxt:     { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textPrimary, flex: 1 },
  pillExtra:   { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.full },
  pillExtraTxt:{ fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.white },
  emptyPill:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontStyle: 'italic' },
  searchWrap:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: COLORS.borderDefault },
  searchInput: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, padding: 0 },
  results:     { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, marginTop: 4, overflow: 'hidden' },
  resultItem:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  resultIcon:  { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8E7E1' },
  resultName:  { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  resultSku:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  itemCard:    { backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: 10, borderWidth: 1, borderColor: COLORS.borderDefault },
  itemHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  itemIcon:    { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8E7E1' },
  itemName:    { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
});

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────

export default function TotalStockScreen() {
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const params = useLocalSearchParams<{ whId?: string }>();

  // Search & filters
  const [query,    setQuery]    = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [selWh,  setSelWh]  = useState<string[]>([]);
  const [selCat, setSelCat] = useState<string[]>([]);
  const [selGrp, setSelGrp] = useState<string[]>([]);

  // Header "+" popover menu
  const [menuOpen, setMenuOpen] = useState(false);

  // Multi-select
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedIds,     setSelectedIds]     = useState<string[]>([]);

  // Modals
  const [addItemOpen,   setAddItemOpen]   = useState(false);
  const [editItem,      setEditItem]      = useState<StockItem | null>(null);
  const [transferItem,  setTransferItem]  = useState<StockItem | null>(null);
  const [bulkOpen,      setBulkOpen]      = useState(false);
  const [bulkPreItems,  setBulkPreItems]  = useState<StockItem[]>([]);

  // Derived
  const filtered = STOCK_ITEMS.filter(item => {
    const q = query.toLowerCase();
    const qMatch  = !query || item.name.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q);
    const whMatch  = selWh.length  === 0 || selWh.includes(item.warehouse);
    const catMatch = selCat.length === 0 || selCat.includes(item.category);
    const grpMatch = selGrp.length === 0 || selGrp.includes(item.group);
    return qMatch && whMatch && catMatch && grpMatch;
  });

  const totalQty          = STOCK_ITEMS.reduce((s, i) => s + i.qty, 0);
  const activeFilterCount = selWh.length + selCat.length + selGrp.length;
  const allSelected       = filtered.length > 0 && filtered.every(i => selectedIds.includes(i.id));

  // Handlers
  const handleLongPress = useCallback((id: string) => {
    setMultiSelectMode(true);
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  const handleItemPress = useCallback((item: StockItem) => {
    if (multiSelectMode) {
      setSelectedIds(prev => prev.includes(item.id) ? prev.filter(x => x !== item.id) : [...prev, item.id]);
    } else {
      router.push(`/stocks/item-detail?id=${item.id}` as any);
    }
  }, [multiSelectMode, router]);

  const exitMultiSelect = useCallback(() => { setMultiSelectMode(false); setSelectedIds([]); }, []);

  const handleSharePDF = useCallback(() => {
    if (!selectedIds.length) { Toast.show({ type: 'error', text1: 'No Items', text2: 'Select items first.' }); return; }
    Toast.show({ type: 'success', text1: 'PDF Exported', text2: `${selectedIds.length} items exported as PDF.` });
    exitMultiSelect();
  }, [selectedIds.length, exitMultiSelect]);

  const openBulkFromMultiselect = useCallback(() => {
    if (!selectedIds.length) return;
    const items = STOCK_ITEMS.filter(i => selectedIds.includes(i.id));
    setBulkPreItems(items); setBulkOpen(true);
  }, [selectedIds]);

  const openBulkFromMenu = useCallback(() => {
    setMenuOpen(false); setBulkPreItems([]); setBulkOpen(true);
  }, []);

  return (
    <SafeAreaView style={styles.safe}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Total Stock</Text>
        <View style={styles.headerRight}>
          {/* Filter / Sort icon */}
          <TouchableOpacity style={styles.iconBtn} onPress={() => setFilterOpen(true)} activeOpacity={0.7}>
            <Ionicons name="swap-vertical-outline" size={22} color={activeFilterCount > 0 ? '#A89060' : COLORS.textPrimary} />
            {activeFilterCount > 0 && <View style={styles.badge}><Text style={styles.badgeTxt}>{activeFilterCount}</Text></View>}
          </TouchableOpacity>
          {/* Plus icon → popover */}
          <TouchableOpacity style={styles.iconBtn} onPress={() => setMenuOpen(v => !v)} activeOpacity={0.7}>
            <Ionicons name="add" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Header "+" popover ── */}
      {menuOpen && (
        <TouchableOpacity style={[StyleSheet.absoluteFillObject, { zIndex: 98 }]} activeOpacity={1} onPress={() => setMenuOpen(false)} />
      )}
      {menuOpen && (
        <View style={styles.popover}>
          <TouchableOpacity style={styles.popoverItem} onPress={() => { setMenuOpen(false); setAddItemOpen(true); }} activeOpacity={0.8}>
            <Ionicons name="add-circle-outline" size={18} color={COLORS.textPrimary} />
            <Text style={styles.popoverItemTxt}>Add New Item</Text>
          </TouchableOpacity>
          <View style={styles.popoverDivider} />
          <TouchableOpacity style={styles.popoverItem} onPress={openBulkFromMenu} activeOpacity={0.8}>
            <Ionicons name="swap-vertical-outline" size={18} color={COLORS.textPrimary} />
            <Text style={styles.popoverItemTxt}>Bulk Transfer</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Multi-select bar ── */}
      {multiSelectMode && (
        <View style={styles.multiBar}>
          <TouchableOpacity onPress={exitMultiSelect} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={20} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.multiCount}>{selectedIds.length} selected</Text>
          <View style={styles.multiActions}>
            <TouchableOpacity style={[styles.multiBtn, styles.multiBtnAmber]} onPress={handleSharePDF} activeOpacity={0.8}>
              <Ionicons name="share-outline" size={15} color={COLORS.white} />
              <Text style={styles.multiBtnTxt}>PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.multiBtn, styles.multiBtnGray]} onPress={openBulkFromMultiselect} activeOpacity={0.8}>
              <Ionicons name="swap-horizontal-outline" size={15} color={COLORS.white} />
              <Text style={styles.multiBtnTxt}>Transfer</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Active filter chips ── */}
      {activeFilterCount > 0 && !multiSelectMode && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeFiltersRow}>
          {selWh.map(w => { const f = ALL_WAREHOUSES.find(x => x.id === w); return (
            <TouchableOpacity key={w} style={styles.activeChip} onPress={() => setSelWh(p => p.filter(x => x !== w))} activeOpacity={0.7}>
              <Text style={styles.activeChipTxt}>{f?.label.split(' – ')[0] ?? w}</Text>
              <Ionicons name="close" size={11} color="#A89060" />
            </TouchableOpacity>
          ); })}
          {selCat.map(c => (
            <TouchableOpacity key={c} style={styles.activeChip} onPress={() => setSelCat(p => p.filter(x => x !== c))} activeOpacity={0.7}>
              <Text style={styles.activeChipTxt}>{c}</Text><Ionicons name="close" size={11} color="#A89060" />
            </TouchableOpacity>
          ))}
          {selGrp.map(g => (
            <TouchableOpacity key={g} style={styles.activeChip} onPress={() => setSelGrp(p => p.filter(x => x !== g))} activeOpacity={0.7}>
              <Text style={styles.activeChipTxt}>{g}</Text><Ionicons name="close" size={11} color="#A89060" />
            </TouchableOpacity>
          ))}
        </ScrollView>
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
        <TextInput style={styles.searchInput} placeholder="Search items..." placeholderTextColor={COLORS.textTertiary} value={query} onChangeText={setQuery} />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color={COLORS.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Item list ── */}
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.listHeader}>
          <Text style={styles.sectionLabel}>{filtered.length} item{filtered.length !== 1 ? 's' : ''}</Text>
          {multiSelectMode ? (
            <TouchableOpacity onPress={() => setSelectedIds(allSelected ? [] : filtered.map(i => i.id))} activeOpacity={0.7}>
              <Text style={styles.selectAllTxt}>{allSelected ? 'Deselect All' : 'Select All'}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.swipeHint}>
              <Ionicons name="swap-horizontal-outline" size={12} color={COLORS.textTertiary} />
              <Text style={styles.swipeHintTxt}>Swipe for actions</Text>
            </View>
          )}
        </View>

        {filtered.map(item => (
          <SwipeableStockCard
            key={item.id} item={item}
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
            <TouchableOpacity onPress={() => { setSelWh([]); setSelCat([]); setSelGrp([]); setQuery(''); }} activeOpacity={0.7}>
              <Text style={styles.emptyAction}>Clear all filters</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={{ height: 60 }} />
      </ScrollView>

      {/* ── Modals ── */}
      <FilterModal visible={filterOpen} onClose={() => setFilterOpen(false)} onApply={(wh, cat, grp) => { setSelWh(wh); setSelCat(cat); setSelGrp(grp); }} initWh={selWh} initCat={selCat} initGrp={selGrp} />
      <AddItemModal visible={addItemOpen} onClose={() => setAddItemOpen(false)} />
      <EditStockModal visible={!!editItem} item={editItem} onClose={() => setEditItem(null)} />
      <StockTransferModal visible={!!transferItem} item={transferItem} onClose={() => setTransferItem(null)} />
      <BulkTransferModal visible={bulkOpen} preselectedItems={bulkPreItems} onClose={() => { setBulkOpen(false); exitMultiSelect(); }} />
    </SafeAreaView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.pageBg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 14, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  backBtn:     { width: 40, alignItems: 'flex-start' },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  headerRight: { width: 80, flexDirection: 'row', justifyContent: 'flex-end', gap: 2 },
  iconBtn:     { position: 'relative', padding: 8 },
  badge:       { position: 'absolute', top: 4, right: 4, width: 15, height: 15, borderRadius: 8, backgroundColor: '#A89060', alignItems: 'center', justifyContent: 'center' },
  badgeTxt:    { fontSize: 8, fontWeight: '800', color: COLORS.white },

  // Popover
  popover:        { position: 'absolute', top: 58, right: 12, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.14, shadowRadius: 16, elevation: 10, zIndex: 99, minWidth: 200, overflow: 'hidden' },
  popoverItem:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: SPACING.md, paddingVertical: 14 },
  popoverItemTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textPrimary },
  popoverDivider: { height: 1, backgroundColor: COLORS.borderDefault, marginHorizontal: SPACING.md },

  // Multi-select bar
  multiBar:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: SPACING.md, paddingVertical: 12, backgroundColor: '#1A1A1A' },
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

  // Summary KPI
  summaryRow:   { flexDirection: 'row', backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, paddingVertical: 12 },
  summaryItem:  { flex: 1, alignItems: 'center' },
  summaryVal:   { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary },
  summaryLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },

  // Search
  searchWrap:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: SPACING.md, marginTop: 12, marginBottom: 4, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.borderDefault },
  searchInput: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, padding: 0 },

  // List
  scroll:       { flex: 1 },
  content:      { padding: SPACING.md, gap: 8 },
  listHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  sectionLabel: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textTertiary },
  selectAllTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: '#A89060' },
  swipeHint:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  swipeHintTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyTxt:   { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textTertiary },
  emptyAction:{ fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: '#A89060', textDecorationLine: 'underline' },
});
