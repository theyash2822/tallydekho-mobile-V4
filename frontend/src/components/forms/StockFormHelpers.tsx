import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../constants/colors';
import { StockItem, LOW_STOCK_QTY } from '../../data/stockData';

// ─── BUTTON PHASE ─────────────────────────────────────────────────────────────
export type BtnPhase = 'idle' | 'loading' | 'success';

// ─── MODAL SHARED STYLES ──────────────────────────────────────────────────────
export const modalStyles = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.48)' },
  sheet:      { backgroundColor: COLORS.cardBg, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '92%', paddingTop: 10 },
  handle:     { width: 40, height: 4, backgroundColor: COLORS.borderStrong, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  titleRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  title:      { fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  scroll:     { padding: SPACING.md },
  footer:     { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.borderDefault, marginBottom: 4 },
  row:        { flexDirection: 'row', gap: 10, marginBottom: SPACING.md },
  divider:    { height: 1, backgroundColor: COLORS.borderDefault, marginVertical: 12 },
  sectionLbl: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
});

// ─── INLINE DROPDOWN (safe inside Modals — no nested Modal) ──────────────────
export function InlineDropdownField({
  label, options, value, onSelect, placeholder, icon, required,
}: {
  label: string;
  options: { id: string; label: string }[];
  value: string;
  onSelect: (id: string) => void;
  placeholder?: string;
  icon?: string;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [fieldH, setFieldH] = useState(76); // label + trigger combined height
  const selected = options.find(o => o.id === value);

  return (
    <View
      style={[idd.wrap, open && idd.wrapOpen]}
      onLayout={e => setFieldH(e.nativeEvent.layout.height)}
    >
      <Text style={idd.label}>
        {label}{required ? <Text style={idd.star}> *</Text> : null}
      </Text>
      <TouchableOpacity
        style={[idd.trigger, open && idd.triggerOpen]}
        onPress={() => setOpen(v => !v)}
        activeOpacity={0.7}
      >
        {icon ? <Ionicons name={icon as any} size={15} color={COLORS.textTertiary} style={{ marginRight: 8 }} /> : null}
        <Text style={[idd.triggerTxt, !value && idd.placeholder]} numberOfLines={1}>
          {selected?.label ?? (placeholder ?? '—')}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textTertiary} />
      </TouchableOpacity>
      {open ? (
        <View style={[idd.menu, { position: 'absolute', top: fieldH + 4, left: 0, right: 0, zIndex: 1000, elevation: 1000 }]}>
          {options.map((opt, idx) => (
            <TouchableOpacity
              key={opt.id}
              style={[
                idd.menuItem,
                idx < options.length - 1 && idd.menuItemBorder,
                value === opt.id && idd.menuItemActive,
              ]}
              onPress={() => { onSelect(opt.id); setOpen(false); }}
              activeOpacity={0.7}
            >
              <Text style={[idd.menuTxt, value === opt.id && idd.menuTxtActive]}>{opt.label}</Text>
              {value === opt.id ? <Ionicons name="checkmark" size={14} color={COLORS.brandPrimary} /> : null}
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const idd = StyleSheet.create({
  wrap:           { flex: 1, marginBottom: SPACING.md },
  wrapOpen:       { zIndex: 999, elevation: 999 },
  label:          { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  star:           { color: COLORS.negative },
  trigger:        { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, minHeight: 48 },
  triggerOpen:    { borderColor: COLORS.brandPrimary, borderWidth: 1.5 },
  triggerTxt:     { flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, marginRight: 4 },
  placeholder:    { color: COLORS.textTertiary },
  menu:           { backgroundColor: COLORS.cardBg, borderWidth: 1.5, borderColor: COLORS.brandPrimary, borderRadius: RADIUS.md, overflow: 'hidden',
                    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8 },
  menuItem:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 13 },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  menuItemActive: { backgroundColor: COLORS.pageBg },
  menuTxt:        { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  menuTxtActive:  { fontWeight: '700', color: COLORS.brandPrimary },
});

// ─── QTY STEPPER FIELD ────────────────────────────────────────────────────────
export function QtyStepperField({
  label, subLabel, value, onChange,
}: {
  label?: string; subLabel?: string; value: number; onChange: (v: number) => void;
}) {
  return (
    <View style={qs.wrap}>
      {label ? (
        <Text style={qs.label}>
          {label}{subLabel ? <Text style={qs.sub}> {subLabel}</Text> : null}
        </Text>
      ) : null}
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
  wrap:  { flex: 1, marginBottom: SPACING.md },
  label: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  sub:   { fontSize: TYPOGRAPHY.xs, fontWeight: '400', color: COLORS.negative },
  row:   { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, minHeight: 48 },
  btn:   { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
  val:   { flex: 1, textAlign: 'center', fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
});

// ─── 3-STATE SUBMIT BUTTON ────────────────────────────────────────────────────
export function SubmitButton({
  idleLabel, loadingLabel, successLabel, onValidate, onDone,
}: {
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
      onPress={handlePress}
      disabled={phase !== 'idle'}
      activeOpacity={0.85}
    >
      {phase === 'loading' ? <ActivityIndicator size="small" color={COLORS.white} style={{ marginRight: 6 }} /> : null}
      {phase === 'success' ? <Ionicons name="checkmark-circle" size={18} color={COLORS.white} style={{ marginRight: 6 }} /> : null}
      <Text style={sb.txt}>
        {phase === 'idle' ? idleLabel : phase === 'loading' ? loadingLabel : successLabel}
      </Text>
    </TouchableOpacity>
  );
}

const sb = StyleSheet.create({
  btn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary },
  btnLoading: { opacity: 0.72 },
  btnSuccess: { backgroundColor: COLORS.positive },
  txt:        { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});

// ─── ITEM HEADER CARD ─────────────────────────────────────────────────────────
export function ItemHeaderCard({ item }: { item: StockItem }) {
  const isLow = item.qty < LOW_STOCK_QTY;
  return (
    <View style={ih.card}>
      <View style={ih.icon}>
        <Ionicons name="cube-outline" size={20} color={COLORS.textPrimary} />
      </View>
      <View style={ih.info}>
        <Text style={ih.name} numberOfLines={1}>{item.name}</Text>
        <Text style={ih.sku}>{item.sku}</Text>
      </View>
      {isLow ? (
        <View style={ih.lowBadge}>
          <Ionicons name="warning-outline" size={11} color={COLORS.warning} />
          <Text style={ih.lowTxt}>Low stock</Text>
        </View>
      ) : null}
      <View style={ih.stockBadge}>
        <Text style={ih.stockNum}>{item.qty}</Text>
        <Text style={ih.stockLbl}> Stock</Text>
      </View>
    </View>
  );
}

const ih = StyleSheet.create({
  card:       { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  icon:       { width: 38, height: 38, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8E7E1' },
  info:       { flex: 1 },
  name:       { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  sku:        { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 1 },
  lowBadge:   { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: COLORS.warningBg, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  lowTxt:     { fontSize: 10, fontWeight: '700', color: COLORS.warning },
  stockBadge: { flexDirection: 'row', alignItems: 'baseline' },
  stockNum:   { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary },
  stockLbl:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
});

// ─── READ-ONLY FIELD ──────────────────────────────────────────────────────────
export function ReadonlyField({
  label, value, icon,
}: {
  label: string; value: string; icon?: string;
}) {
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

// ─── INLINE TEXT FIELD ────────────────────────────────────────────────────────
export function InlineField({
  label, value, onChange, placeholder, keyboardType, multiline, required,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
  keyboardType?: any; multiline?: boolean; required?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={inf.wrap}>
      <Text style={inf.label}>
        {label}{required ? <Text style={inf.star}> *</Text> : null}
      </Text>
      <TextInput
        style={[inf.input, focused && inf.focused, multiline && { minHeight: 64, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? '—'}
        placeholderTextColor={COLORS.textTertiary}
        keyboardType={keyboardType}
        multiline={multiline}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
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

// ─── CURRENCY FIELD ───────────────────────────────────────────────────────────
export function CurrencyField({
  label, value, onChange, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={currf.wrap}>
      <Text style={currf.label}>{label}</Text>
      <View style={[currf.row, focused && currf.rowFocused]}>
        <TextInput
          style={currf.input}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder ?? '0.00'}
          placeholderTextColor={COLORS.textTertiary}
          keyboardType="decimal-pad"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        <View style={currf.badge}>
          <Text style={currf.badgeTxt}>INR</Text>
        </View>
      </View>
    </View>
  );
}

const currf = StyleSheet.create({
  wrap:       { flex: 1, marginBottom: SPACING.md },
  label:      { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  row:        { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, minHeight: 48, overflow: 'hidden' },
  rowFocused: { borderColor: COLORS.brandPrimary, borderWidth: 1.5 },
  input:      { flex: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  badge:      { paddingHorizontal: 12, paddingVertical: 12, backgroundColor: COLORS.pageBg, borderLeftWidth: 1, borderLeftColor: COLORS.borderDefault, alignSelf: 'stretch', justifyContent: 'center', alignItems: 'center' },
  badgeTxt:   { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textTertiary },
});
