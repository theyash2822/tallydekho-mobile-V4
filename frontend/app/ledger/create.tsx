import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, TextInput, TextInputProps, ActivityIndicator,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { createLedger } from '../../src/services/api';
import RegularOptionalToggle, { EntryType } from '../../src/components/forms/RegularOptionalToggle';
import FormDropdown from '../../src/components/forms/FormDropdown';
import SearchableDropdown from '../../src/components/forms/SearchableDropdown';
import BrandSwitch from '../../src/components/forms/BrandSwitch';

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

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Chandigarh', 'Puducherry',
];

const ALL_TALLY_GROUPS = [
  'Capital Account', 'Reserves & Surplus', 'Sundry Creditors', 'Sundry Debtors',
  'Bank Accounts', 'Bank OD Accounts', 'Cash-in-Hand', 'Duties & Taxes',
  'Fixed Assets', 'Investments', 'Loans & Advances (Asset)', 'Loans (Liability)',
  'Secured Loans', 'Unsecured Loans', 'Current Assets', 'Current Liabilities',
  'Provisions', 'Deposits (Asset)', 'Stock-in-Hand', 'Sales Accounts',
  'Purchase Accounts', 'Direct Expenses', 'Indirect Expenses',
  'Direct Income', 'Indirect Income', 'Misc. Expenses (Asset)',
];

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
        <BrandSwitch value={isCr} onValueChange={onToggleCr} />
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
      <BrandSwitch value={value} onValueChange={onChange} />
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function CreateLedgerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ type?: string }>();
  const { company, isPaired } = useAuth();
  const [submitting, setSubmitting] = useState(false);
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
  // Mailing Details
  const [mailingName, setMailingName] = useState('');
  const [address, setAddress] = useState('');
  const [stateVal, setStateVal] = useState('');
  const [pincode, setPincode] = useState('');
  const [country, setCountry] = useState('India');
  // Bank Details
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNo, setAccountNo] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [bankBranch, setBankBranch] = useState('');
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

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Required', 'Ledger name is required.'); return; }
    if (isDuties && !dutyType) { Alert.alert('Required', 'Please select a duty/tax type.'); return; }
    if (!isPaired) { Toast.show({ type: 'error', text1: 'Not Paired', text2: 'Please pair with Tally Desktop first.' }); return; }
    try {
      setSubmitting(true);
      await createLedger({
        company_guid: company?.guid,
        name, ledger_type: lType,
        opening_balance: parseFloat(openBalance) || 0,
        is_credit: isCr,
        group: cfg.group || groupSearch || undefined,
      });
      Toast.show({ type: 'success', text1: 'Ledger Created', text2: `"${name}" added to Tally.` });
      setTimeout(() => router.back(), 1200);
    } catch(err:any) {
      Toast.show({ type: 'error', text1: 'Failed', text2: err?.message||'Could not create ledger.' });
    } finally { setSubmitting(false); }
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
          keyboardDismissMode="on-drag"
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
            <SearchableDropdown
              label="Under (Group)"
              required
              placeholder="Search or type group name..."
              options={ALL_TALLY_GROUPS.map(g => ({ label: g, value: g }))}
              value={customGroup}
              onSelect={o => setCustomGroup(o.value)}
              icon="folder-outline"
            />
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
                <FormDropdown
                  label="Type of Duty / Tax"
                  required
                  value={dutyType}
                  options={DUTY_TYPES.map(s => ({ label: s, value: s }))}
                  placeholder="Select type"
                  onSelect={o => setDutyType(o.value)}
                />
              </View>

              {/* Percentage of Calculation */}
              <View style={{ flex: 1 }}>
                <Text style={[s.label, { marginTop: 0, marginBottom: 6 }]}>% of Calculation <Text style={s.required}>*</Text></Text>
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

          {showGstSection && (
            <>
              {/* Divider */}
              <View style={s.divider} />

              {/* ── Enable Mailing Details ── */}
              <ToggleRow label="Enable Mailing Details" value={mailingEnabled} onChange={setMailingEnabled} />
              {mailingEnabled && (
                <View style={s.expandSection}>
                  <Text style={s.label}>Mailing Name</Text>
                  <ThemedInput placeholder="Enter mailing name" value={mailingName} onChangeText={setMailingName} />

                  <Text style={s.label}>Address</Text>
                  <ThemedInput
                    placeholder="Enter address"
                    value={address} onChangeText={setAddress}
                    multiline numberOfLines={3}
                    style={s.textarea}
                  />

                  <FormDropdown
                    label="State"
                    value={stateVal}
                    options={INDIAN_STATES.map(s => ({ label: s, value: s }))}
                    placeholder="Select state"
                    onSelect={o => setStateVal(o.value)}
                  />

                  <View style={s.row2}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.label}>Pincode</Text>
                      <ThemedInput placeholder="Enter pincode" value={pincode} onChangeText={setPincode} keyboardType="numeric" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.label}>Country</Text>
                      <ThemedInput value={country} onChangeText={setCountry} />
                    </View>
                  </View>
                </View>
              )}

              {/* ── Provide Bank Details ── */}
              <ToggleRow label="Provide Bank Details" value={bankEnabled} onChange={setBankEnabled} />
              {bankEnabled && (
                <View style={s.expandSection}>
                  <Text style={s.label}>Beneficiary Name</Text>
                  <ThemedInput placeholder="Enter beneficiary name" value={beneficiaryName} onChangeText={setBeneficiaryName} />

                  <Text style={s.label}>Bank Name</Text>
                  <ThemedInput placeholder="Enter bank name" value={bankName} onChangeText={setBankName} />

                  <Text style={s.label}>Account Number</Text>
                  <ThemedInput placeholder="Enter account number" value={accountNo} onChangeText={setAccountNo} keyboardType="numeric" />

                  <Text style={s.label}>IFSC Code</Text>
                  <ThemedInput placeholder="Enter IFSC code" value={ifscCode} onChangeText={v => setIfscCode(v.toUpperCase())} autoCapitalize="characters" />

                  <Text style={s.label}>Bank Branch</Text>
                  <ThemedInput placeholder="Enter branch name" value={bankBranch} onChangeText={setBankBranch} />
                </View>
              )}

              <View style={s.divider} />

              <FormDropdown
                label="GST Registration Type"
                required
                value={gstRegType}
                options={GST_REG_TYPES.map(s => ({ label: s, value: s }))}
                onSelect={o => setGstRegType(o.value)}
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
          <TouchableOpacity style={[s.saveBtn,submitting&&{opacity:0.6}]} onPress={handleSave} activeOpacity={0.85} disabled={submitting}>
            {submitting&&<ActivityIndicator size="small" color={COLORS.white} style={{marginRight:8}}/>}
            <Text style={s.saveBtnText}>{submitting?'Saving...':'Save Ledger'}</Text>
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
  // Expand section (fields revealed when toggle is ON)
  expandSection: {
    backgroundColor: COLORS.pageBg,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
  },
  textarea: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: 12,
  },

  // Row of 2 columns — align from top
  row2: { flexDirection: 'row', gap: 12, marginTop: 18, alignItems: 'flex-start' },

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
