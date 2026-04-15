import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, TextInput, Switch, TextInputProps,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import RegularOptionalToggle, { EntryType } from '../../src/components/forms/RegularOptionalToggle';

// ─── Themed TextInput (no blue focus ring) ────────────────────────────────────
function ThemedInput({ style, onFocus, onBlur, ...props }: TextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      style={[
        s.input,
        focused && s.inputFocused,
        Platform.select({ web: { outlineWidth: 0, outlineStyle: 'none' } as any }),
        style,
      ]}
      placeholderTextColor={COLORS.textTertiary}
      onFocus={(e) => { setFocused(true); onFocus?.(e); }}
      onBlur={(e)  => { setFocused(false); onBlur?.(e); }}
      {...props}
    />
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
type LedgerType = 'sundry_creditor' | 'sundry_debtor' | 'duties_taxes' | 'custom';

const TYPE_CONFIG: Record<LedgerType, { title: string; group: string }> = {
  sundry_creditor: { title: 'Sundry Creditors', group: 'Sundry Creditors' },
  sundry_debtor:   { title: 'Sundry Debtors',   group: 'Sundry Debtors' },
  duties_taxes:    { title: 'Duties & Taxes',    group: 'Duties & Taxes' },
  custom:          { title: 'Custom Groups',     group: '' },
};

const GST_REG_TYPES = ['Regular', 'Unregistered', 'Composition'];

const DUTY_TYPES = ['CGST', 'SGST', 'IGST', 'Cess', 'Others'];

const ALL_TALLY_GROUPS = [
  'Capital Account', 'Reserves & Surplus', 'Sundry Creditors', 'Sundry Debtors',
  'Bank Accounts', 'Bank OD Accounts', 'Cash-in-Hand', 'Duties & Taxes',
  'Fixed Assets', 'Investments', 'Loans & Advances (Asset)', 'Loans (Liability)',
  'Secured Loans', 'Unsecured Loans', 'Current Assets', 'Current Liabilities',
  'Provisions', 'Deposits (Asset)', 'Stock-in-Hand', 'Sales Accounts',
  'Purchase Accounts', 'Direct Expenses', 'Indirect Expenses',
  'Direct Income', 'Indirect Income', 'Misc. Expenses (Asset)',
];

// ─── Inline Accordion Dropdown ────────────────────────────────────────────────
interface InlineDropdownProps {
  label: string;
  required?: boolean;
  value: string;
  options: string[];
  placeholder?: string;
  onSelect: (val: string) => void;
}

function InlineDropdown({ label, required, value, options, placeholder = 'Select', onSelect }: InlineDropdownProps) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Text style={s.label}>
        {label}{required && <Text style={s.required}> *</Text>}
      </Text>
      <TouchableOpacity
        style={[s.selectBox, open && s.selectBoxOpen]}
        onPress={() => setOpen(!open)}
        activeOpacity={0.7}
      >
        <Text style={[s.selectText, !value && { color: COLORS.textTertiary }]}>
          {value || placeholder}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textSecondary} />
      </TouchableOpacity>
      {open && (
        <View style={s.dropList}>
          {options.map((opt, idx) => (
            <TouchableOpacity
              key={opt}
              style={[s.dropItem, idx === options.length - 1 && { borderBottomWidth: 0 }]}
              onPress={() => { onSelect(opt); setOpen(false); }}
              activeOpacity={0.7}
            >
              <Text style={[s.dropItemText, value === opt && s.dropItemTextActive]}>{opt}</Text>
              {value === opt && <Ionicons name="checkmark" size={16} color={COLORS.brandPrimary} />}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Opening Balance Row ──────────────────────────────────────────────────────
interface BalanceRowProps {
  value: string;
  onChange: (v: string) => void;
  isCr: boolean;
  onToggleCr: (v: boolean) => void;
}

function BalanceRow({ value, onChange, isCr, onToggleCr }: BalanceRowProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[s.balanceBox, focused && s.balanceBoxFocused]}>
      <TextInput
        style={[
          s.balanceInput,
          Platform.select({ web: { outlineWidth: 0, outlineStyle: 'none' } as any }),
        ]}
        placeholder="0.00"
        placeholderTextColor={COLORS.textTertiary}
        value={value}
        onChangeText={onChange}
        keyboardType="numeric"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      <View style={s.drCrWrap}>
        <Text style={[s.drCrLabel, !isCr && s.drCrLabelActive]}>Dr</Text>
        <Switch
          value={isCr}
          onValueChange={onToggleCr}
          trackColor={{ false: COLORS.borderStrong, true: COLORS.borderStrong }}
          thumbColor={COLORS.white}
          ios_backgroundColor={COLORS.borderStrong}
        />
        <Text style={[s.drCrLabel, isCr && s.drCrLabelActive]}>Cr</Text>
      </View>
    </View>
  );
}

// ─── Toggle Row ───────────────────────────────────────────────────────────────
interface ToggleRowProps {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}

function ToggleRow({ label, value, onChange }: ToggleRowProps) {
  return (
    <View style={s.toggleRow}>
      <Text style={s.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: COLORS.borderStrong, true: COLORS.brandPrimary }}
        thumbColor={COLORS.white}
        ios_backgroundColor={COLORS.borderStrong}
      />
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function CreateLedgerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ type?: string }>();
  const [entryType, setEntryType] = useState<EntryType>('regular');

  const lType = (
    ['sundry_creditor', 'sundry_debtor', 'duties_taxes', 'custom'].includes(params.type || '')
      ? params.type
      : 'custom'
  ) as LedgerType;

  const cfg = TYPE_CONFIG[lType];
  const isParty = lType === 'sundry_creditor' || lType === 'sundry_debtor';
  const isDuties = lType === 'duties_taxes';
  const isCustom = lType === 'custom';
  const showGstSection = isParty || isCustom;

  // ── Common fields
  const [name, setName] = useState('');
  const [openBalance, setOpenBalance] = useState('');
  const [isCr, setIsCr] = useState(false);

  // ── Party fields (Sundry Creditor / Debtor)
  const [creditDays, setCreditDays] = useState('');
  const [mailingEnabled, setMailingEnabled] = useState(false);
  const [bankEnabled, setBankEnabled] = useState(false);
  const [gstRegType, setGstRegType] = useState('Regular');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');

  // ── Custom group fields
  const [customGroup, setCustomGroup] = useState('');
  const [groupSearch, setGroupSearch] = useState('');
  const [groupDropOpen, setGroupDropOpen] = useState(false);
  const [groupSearchFocused, setGroupSearchFocused] = useState(false);

  // ── Duties & Taxes fields
  const [dutyType, setDutyType] = useState('');
  const [percentage, setPercentage] = useState('');

  const filteredGroups = ALL_TALLY_GROUPS.filter(g =>
    g.toLowerCase().includes(groupSearch.toLowerCase())
  );

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Ledger name is required.');
      return;
    }
    if (isDuties && !dutyType) {
      Alert.alert('Required', 'Please select a duty/tax type.');
      return;
    }
    Alert.alert(
      '✓ Ledger Created',
      `"${name}" has been added successfully.`,
      [{ text: 'OK', onPress: () => router.back() }]
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{cfg.title}</Text>
        <RegularOptionalToggle value={entryType} onChange={setEntryType} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.form}
        >

          {/* ── Name ── */}
          <Text style={s.label}>Name <Text style={s.required}>*</Text></Text>
          <ThemedInput
            placeholder="Enter ledger name"
            value={name}
            onChangeText={setName}
          />

          {/* ── Custom Group: Under (Group) search ── */}
          {isCustom && (
            <>
              <Text style={s.label}>Under (Group) <Text style={s.required}>*</Text></Text>
              <TouchableOpacity
                style={[s.searchBox, groupSearchFocused && s.searchBoxFocused]}
                onPress={() => setGroupDropOpen(!groupDropOpen)}
                activeOpacity={0.9}
              >
                <Ionicons name="search" size={16} color={COLORS.textTertiary} />
                <TextInput
                  style={[
                    s.searchInput,
                    Platform.select({ web: { outlineWidth: 0, outlineStyle: 'none' } as any }),
                  ]}
                  placeholder="Search or type group name..."
                  placeholderTextColor={COLORS.textTertiary}
                  value={groupSearch}
                  onChangeText={(t) => {
                    setGroupSearch(t);
                    setCustomGroup('');
                    setGroupDropOpen(true);
                  }}
                  onFocus={() => setGroupSearchFocused(true)}
                  onBlur={() => setGroupSearchFocused(false)}
                />
                {customGroup !== '' && (
                  <Ionicons name="checkmark-circle" size={16} color={COLORS.positive} />
                )}
              </TouchableOpacity>
              {groupDropOpen && (
                <View style={s.dropList}>
                  {filteredGroups.map((g, idx) => (
                    <TouchableOpacity
                      key={g}
                      style={[s.dropItem, idx === filteredGroups.length - 1 && { borderBottomWidth: 0 }]}
                      onPress={() => {
                        setCustomGroup(g);
                        setGroupSearch(g);
                        setGroupDropOpen(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.dropItemText, customGroup === g && s.dropItemTextActive]}>{g}</Text>
                      {customGroup === g && <Ionicons name="checkmark" size={16} color={COLORS.brandPrimary} />}
                    </TouchableOpacity>
                  ))}
                  {filteredGroups.length === 0 && (
                    <View style={s.dropItem}>
                      <Text style={{ color: COLORS.textTertiary, fontSize: TYPOGRAPHY.sm }}>No groups found</Text>
                    </View>
                  )}
                </View>
              )}
            </>
          )}

          {/* ── Opening Balance ── */}
          <Text style={s.label}>Opening Balance <Text style={s.required}>*</Text></Text>
          <BalanceRow
            value={openBalance}
            onChange={setOpenBalance}
            isCr={isCr}
            onToggleCr={setIsCr}
          />

          {/* ── Credit Period (Party only) ── */}
          {isParty && (
            <>
              <Text style={s.label}>Credit Period (Days)</Text>
              <ThemedInput
                placeholder="Enter credit period in days"
                value={creditDays}
                onChangeText={setCreditDays}
                keyboardType="numeric"
              />
            </>
          )}

          {/* ── Duties & Taxes: Type + Percentage side-by-side ── */}
          {isDuties && (
            <View style={s.row2}>
              {/* Type of Duty / Tax */}
              <View style={{ flex: 1 }}>
                <InlineDropdown
                  label="Type of Duty / Tax"
                  required
                  value={dutyType}
                  options={DUTY_TYPES}
                  placeholder="Select type"
                  onSelect={setDutyType}
                />
              </View>

              {/* Percentage of Calculation */}
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Percentage of Calculation <Text style={s.required}>*</Text></Text>
                <View style={s.percentBox}>
                  <TextInput
                    style={[
                      s.percentInput,
                      Platform.select({ web: { outlineWidth: 0, outlineStyle: 'none' } as any }),
                    ]}
                    placeholder="0.00"
                    placeholderTextColor={COLORS.textTertiary}
                    value={percentage}
                    onChangeText={setPercentage}
                    keyboardType="decimal-pad"
                  />
                  <View style={s.percentSuffix}>
                    <Text style={s.percentSuffixText}>%</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* ── GST Section (Party + Custom) ── */}
          {showGstSection && (
            <>
              {/* Divider */}
              <View style={s.divider} />

              <ToggleRow
                label="Enable Mailing Details"
                value={mailingEnabled}
                onChange={setMailingEnabled}
              />
              <ToggleRow
                label="Provide Bank Details"
                value={bankEnabled}
                onChange={setBankEnabled}
              />

              <View style={s.divider} />

              <InlineDropdown
                label="GST Registration Type"
                required
                value={gstRegType}
                options={GST_REG_TYPES}
                onSelect={setGstRegType}
              />

              <Text style={s.label}>GSTIN <Text style={s.required}>*</Text></Text>
              <ThemedInput
                placeholder="Enter GSTIN"
                value={gstin}
                onChangeText={v => setGstin(v.toUpperCase())}
                autoCapitalize="characters"
              />

              <Text style={s.label}>PAN/IT No.</Text>
              <ThemedInput
                placeholder="Enter PAN/IT number"
                value={pan}
                onChangeText={v => setPan(v.toUpperCase())}
                autoCapitalize="characters"
              />
            </>
          )}

          <View style={{ height: 20 }} />
        </ScrollView>

        {/* ── Save Button ── */}
        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity style={s.saveBtn} onPress={handleSave} activeOpacity={0.85}>
            <Text style={s.saveBtnText}>Save Ledger</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.cardBg,
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    flex: 1, fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary,
  },

  // Form
  form: { padding: SPACING.md },
  label: {
    fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary,
    marginBottom: 8, marginTop: 18,
  },
  required: { color: COLORS.negative },

  // Text Input
  input: {
    borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary,
    backgroundColor: COLORS.cardBg,
    // Suppress web blue outline
    ...Platform.select({ web: { outlineWidth: 0, outlineStyle: 'none' } as any }),
  },
  inputFocused: {
    borderColor: COLORS.brandPrimary,
    borderWidth: 1.5,
  },

  // Opening Balance
  balanceBox: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md,
    backgroundColor: COLORS.cardBg, paddingLeft: 14, paddingRight: 10,
    paddingVertical: 4,
  },
  balanceBoxFocused: {
    borderColor: COLORS.brandPrimary,
    borderWidth: 1.5,
  },
  balanceInput: {
    flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary,
    paddingVertical: 9,
  },
  drCrWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 8,
  },
  drCrLabel: {
    fontSize: TYPOGRAPHY.sm, fontWeight: '500', color: COLORS.textTertiary,
  },
  drCrLabelActive: {
    color: COLORS.textPrimary, fontWeight: '700',
  },

  // Search box (Custom group)
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md,
    paddingHorizontal: 14, paddingVertical: 4, backgroundColor: COLORS.cardBg,
  },
  searchBoxFocused: {
    borderColor: COLORS.brandPrimary,
    borderWidth: 1.5,
  },
  searchInput: {
    flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary,
    paddingVertical: 9,
  },

  // Accordion select box
  selectBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md,
    paddingHorizontal: 14, paddingVertical: 14,
    backgroundColor: COLORS.cardBg,
  },
  selectBoxOpen: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  selectText: {
    fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, fontWeight: '600',
  },

  // Dropdown list
  dropList: {
    borderWidth: 1, borderTopWidth: 0,
    borderColor: COLORS.borderDefault,
    backgroundColor: COLORS.cardBg,
    borderBottomLeftRadius: RADIUS.md,
    borderBottomRightRadius: RADIUS.md,
    overflow: 'hidden',
  },
  dropItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 15,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  dropItemText: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  dropItemTextActive: { fontWeight: '700' },

  // Toggle row
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 6,
  },
  toggleLabel: { fontSize: TYPOGRAPHY.base, color: COLORS.textSecondary },

  // Divider
  divider: {
    height: 1, backgroundColor: COLORS.borderDefault, marginVertical: 8,
  },

  // Row of 2 columns
  row2: { flexDirection: 'row', gap: 12, marginTop: 18 },

  // Percentage input
  percentBox: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md,
    backgroundColor: COLORS.cardBg, overflow: 'hidden',
  },
  percentInput: {
    flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary,
    paddingHorizontal: 14, paddingVertical: 13,
  },
  percentSuffix: {
    backgroundColor: COLORS.pageBg,
    borderLeftWidth: 1, borderLeftColor: COLORS.borderDefault,
    paddingHorizontal: 12, paddingVertical: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  percentSuffixText: {
    fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textSecondary,
  },

  // Footer / Save button
  footer: {
    paddingHorizontal: SPACING.md, paddingTop: SPACING.md,
    borderTopWidth: 1, borderTopColor: COLORS.borderDefault,
    backgroundColor: COLORS.cardBg,
  },
  saveBtn: {
    backgroundColor: COLORS.brandPrimary,
    borderRadius: RADIUS.md, paddingVertical: 15,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: TYPOGRAPHY.base, fontWeight: '700',
    color: COLORS.white, letterSpacing: 0.3,
  },
});
