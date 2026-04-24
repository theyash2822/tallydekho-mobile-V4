import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import BrandSwitch from '../../src/components/forms/BrandSwitch';

// ── Types ──────────────────────────────────────────────────────────────────
type SelectOption = { label: string; value: string };

// ── Option Row (segmented-style selector) ─────────────────────────────────
function OptionRow({ label, options, selected, onSelect }: {
  label: string; options: SelectOption[]; selected: string;
  onSelect: (v: string) => void;
}) {
  return (
    <View style={s.optionRow}>
      <Text style={s.optionLabel}>{label}</Text>
      <View style={s.chips}>
        {options.map(o => (
          <TouchableOpacity
            key={o.value}
            style={[s.chip, selected === o.value && s.chipActive]}
            onPress={() => onSelect(o.value)}
            activeOpacity={0.7}
          >
            <Text style={[s.chipTxt, selected === o.value && s.chipTxtActive]}>
              {o.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ── Toggle Row ────────────────────────────────────────────────────────────
function ToggleRow({ icon, label, sub, value, onChange }: {
  icon: string; label: string; sub?: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <View style={s.toggleRow}>
      <View style={s.toggleLeft}>
        <View style={s.rowIcon}><Ionicons name={icon as any} size={16} color={COLORS.textSecondary} /></View>
        <View style={s.toggleText}>
          <Text style={s.rowLabel}>{label}</Text>
          {sub && <Text style={s.rowSub}>{sub}</Text>}
        </View>
      </View>
      <BrandSwitch value={value} onValueChange={onChange} />
    </View>
  );
}

// ── Section Header ────────────────────────────────────────────────────────
function SectionHeader({ icon, title, color, bg }: {
  icon: string; title: string; color: string; bg: string;
}) {
  return (
    <View style={s.secHeader}>
      <View style={[s.secIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon as any} size={15} color={color} />
      </View>
      <Text style={s.secTitle}>{title}</Text>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────
export default function PreferencesScreen() {
  const router = useRouter();

  // Language & Region
  const [language, setLanguage]   = useState('en');
  const [dateFormat, setDateFmt]  = useState('dmy');
  const [timeFormat, setTimeFmt]  = useState('12h');

  // Display
  const [theme, setTheme]         = useState('light');
  const [textSize, setTextSize]   = useState('normal');

  // Number & Currency
  const [numFormat, setNumFormat] = useState('indian');
  const [decimals, setDecimals]   = useState('2');

  // Voucher Defaults
  const [gstType, setGstType]     = useState('regular');
  const [autoNum, setAutoNum]     = useState(true);
  const [showNarration, setNarr]  = useState(true);

  // Data & Sync
  const [autoSave, setAutoSave]   = useState(true);
  const [offline, setOffline]     = useState(false);
  const [analytics, setAnalytics] = useState(true);

  const handleSave = () => {
    Alert.alert('✓ Preferences Saved', 'Your preferences have been updated successfully.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Preferences</Text>
        <TouchableOpacity style={s.saveBtn} onPress={handleSave} activeOpacity={0.7}>
          <Text style={s.saveTxt}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ─── Language & Region ─────────────────────────────── */}
        <SectionHeader icon="language-outline" title="Language & Region" color="#2563EB" bg="#EFF6FF" />
        <View style={s.card}>
          <OptionRow
            label="Language"
            selected={language}
            onSelect={setLanguage}
            options={[
              { label: 'English', value: 'en' },
              { label: 'हिंदी', value: 'hi' },
              { label: 'ગુજ.', value: 'gu' },
              { label: 'मराठी', value: 'mr' },
            ]}
          />
          <View style={s.divider} />
          <OptionRow
            label="Date Format"
            selected={dateFormat}
            onSelect={setDateFmt}
            options={[
              { label: 'DD/MM/YY', value: 'dmy' },
              { label: 'MM/DD/YY', value: 'mdy' },
              { label: 'YYYY-MM', value: 'iso' },
            ]}
          />
          <View style={s.divider} />
          <OptionRow
            label="Time Format"
            selected={timeFormat}
            onSelect={setTimeFmt}
            options={[
              { label: '12-hour', value: '12h' },
              { label: '24-hour', value: '24h' },
            ]}
          />
        </View>

        {/* ─── Display ──────────────────────────────────────── */}
        <SectionHeader icon="color-palette-outline" title="Display & Theme" color="#7C3AED" bg="#F5F3FF" />
        <View style={s.card}>
          <OptionRow
            label="Theme"
            selected={theme}
            onSelect={setTheme}
            options={[
              { label: '☀️ Light', value: 'light' },
              { label: '🌙 Dark', value: 'dark' },
              { label: '⚙️ System', value: 'system' },
            ]}
          />
          <View style={s.divider} />
          <OptionRow
            label="Text Size"
            selected={textSize}
            onSelect={setTextSize}
            options={[
              { label: 'Normal', value: 'normal' },
              { label: 'Large', value: 'large' },
              { label: 'X-Large', value: 'xlarge' },
            ]}
          />
        </View>

        {/* ─── Number & Currency ─────────────────────────────── */}
        <SectionHeader icon="cash-outline" title="Number & Currency" color="#D97706" bg="#FFFBEB" />
        <View style={s.card}>
          <OptionRow
            label="Number Format"
            selected={numFormat}
            onSelect={setNumFormat}
            options={[
              { label: '₹ Indian (Lakh)', value: 'indian' },
              { label: '₹ Intl (Million)', value: 'intl' },
            ]}
          />
          <View style={s.divider} />
          <OptionRow
            label="Decimal Places"
            selected={decimals}
            onSelect={setDecimals}
            options={[
              { label: '0', value: '0' },
              { label: '2', value: '2' },
              { label: '3', value: '3' },
            ]}
          />
          <View style={s.divider} />
          <View style={s.infoRow}>
            <Ionicons name="information-circle-outline" size={14} color={COLORS.info} />
            <Text style={s.infoTxt}>Preview: ₹{numFormat === 'indian' ? '12,34,567.00' : '1,234,567.00'}</Text>
          </View>
        </View>

        {/* ─── Voucher Defaults ──────────────────────────────── */}
        <SectionHeader icon="document-text-outline" title="Voucher Defaults" color="#0891B2" bg="#ECFEFF" />
        <View style={s.card}>
          <OptionRow
            label="GST Registration"
            selected={gstType}
            onSelect={setGstType}
            options={[
              { label: 'Regular', value: 'regular' },
              { label: 'Composition', value: 'composition' },
              { label: 'Unregistered', value: 'unregistered' },
            ]}
          />
          <View style={s.divider} />
          <ToggleRow
            icon="list-outline"
            label="Auto-Numbering"
            sub="Auto-generate voucher numbers"
            value={autoNum}
            onChange={setAutoNum}
          />
          <View style={s.divider} />
          <ToggleRow
            icon="chatbubble-outline"
            label="Show Narration Field"
            sub="Show narration/note in all forms"
            value={showNarration}
            onChange={setNarr}
          />
        </View>

        {/* ─── Data & Sync ───────────────────────────────────── */}
        <SectionHeader icon="cloud-outline" title="Data & Sync" color="#2D7D46" bg="#F0FBF4" />
        <View style={s.card}>
          <ToggleRow
            icon="save-outline"
            label="Auto-Save"
            sub="Automatically save drafts every 5 min"
            value={autoSave}
            onChange={setAutoSave}
          />
          <View style={s.divider} />
          <ToggleRow
            icon="cloud-offline-outline"
            label="Offline Mode"
            sub="Work without internet (sync later)"
            value={offline}
            onChange={setOffline}
          />
          <View style={s.divider} />
          <ToggleRow
            icon="bar-chart-outline"
            label="Usage Analytics"
            sub="Help improve the app anonymously"
            value={analytics}
            onChange={setAnalytics}
          />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Save Footer */}
      <View style={s.footer}>
        <TouchableOpacity style={s.footerBtn} onPress={handleSave} activeOpacity={0.7}>
          <Ionicons name="checkmark-circle" size={18} color={COLORS.white} />
          <Text style={s.footerBtnTxt}>Save Preferences</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm, paddingVertical: 10,
    backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn:     { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary },
  saveBtn:     { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md },
  saveTxt:     { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.white },
  scroll: { flex: 1 },

  secHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: SPACING.md, marginTop: SPACING.md, marginBottom: 8,
  },
  secIcon:  { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  secTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, textTransform: 'uppercase', letterSpacing: 0.5 },

  card: {
    marginHorizontal: SPACING.md, backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: COLORS.borderDefault, marginLeft: 16 },

  optionRow: { padding: SPACING.md, gap: 10 },
  optionLabel: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: RADIUS.full, borderWidth: 1.5,
    borderColor: COLORS.borderDefault, backgroundColor: COLORS.pageBg,
  },
  chipActive:    { borderColor: COLORS.brandPrimary, backgroundColor: COLORS.brandPrimary },
  chipTxt:       { fontSize: TYPOGRAPHY.sm, fontWeight: '500', color: COLORS.textSecondary },
  chipTxtActive: { color: COLORS.white, fontWeight: '700' },

  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 14 },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  rowIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.borderDefault },
  toggleText: { flex: 1 },
  rowLabel: { fontSize: TYPOGRAPHY.base, fontWeight: '500', color: COLORS.textPrimary },
  rowSub:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: SPACING.md, paddingBottom: 14 },
  infoTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.info, fontWeight: '500' },

  footer: {
    paddingHorizontal: SPACING.md, paddingTop: SPACING.md, paddingBottom: SPACING.md,
    borderTopWidth: 1, borderTopColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg,
  },
  footerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md, paddingVertical: 14,
  },
  footerBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});
