import React, { useState, useRef } from 'react';
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
import PartyForm, { PartyFormRef } from '../../src/components/forms/PartyForm';

// ─── Themed TextInput ─────────────────────────────────────────────────────────
function ThemedInput({ style, onFocus, onBlur, ...props }: TextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      style={[
        s.input, focused && s.inputFocused,
        Platform.select({ web: { outlineWidth: 0, outlineStyle: 'none' } as any }),
        style,
      ]}
      placeholderTextColor={COLORS.textTertiary}
      onFocus={e => { setFocused(true); onFocus?.(e); }}
      onBlur={e  => { setFocused(false); onBlur?.(e); }}
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

// ─── Opening Balance Row ──────────────────────────────────────────────────────
function BalanceRow({ value, onChange, isCr, onToggleCr }: {
  value: string; onChange: (v: string) => void;
  isCr: boolean; onToggleCr: (v: boolean) => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[s.balanceBox, focused && s.balanceBoxFocused]}>
      <TextInput
        style={[s.balanceInput, Platform.select({ web: { outlineWidth: 0, outlineStyle: 'none' } as any })]}
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

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function CreateLedgerScreen() {
  const router      = useRouter();
  const insets      = useSafeAreaInsets();
  const params      = useLocalSearchParams<{ type?: string }>();
  const { company, isPaired } = useAuth();

  const lType = (
    ['sundry_creditor', 'sundry_debtor', 'duties_taxes', 'custom'].includes(params.type || '')
      ? params.type
      : 'custom'
  ) as LedgerType;

  const cfg      = TYPE_CONFIG[lType];
  const isParty  = lType === 'sundry_creditor' || lType === 'sundry_debtor';
  const isDuties = lType === 'duties_taxes';
  const isCustom = lType === 'custom';

  // ── Common state
  const [entryType,   setEntryType]   = useState<EntryType>('regular');
  const [name,        setName]        = useState('');
  const [openBalance, setOpenBalance] = useState('');
  const [isCr,        setIsCr]        = useState(false);
  const [submitting,  setSubmitting]  = useState(false);

  // ── Custom group
  const [customGroup,        setCustomGroup]        = useState('');
  const [groupSearch,        setGroupSearch]        = useState('');
  const [groupDropOpen,      setGroupDropOpen]      = useState(false);
  const [groupSearchFocused, setGroupSearchFocused] = useState(false);

  // ── Duties & Taxes
  const [dutyType,   setDutyType]   = useState('');
  const [percentage, setPercentage] = useState('');

  // ── Party form ref (only for sundry debtor / creditor)
  const formRef = useRef<PartyFormRef>(null);

  const filteredGroups = ALL_TALLY_GROUPS.filter(g =>
    g.toLowerCase().includes(groupSearch.toLowerCase())
  );

  // ─── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Ledger name is required.');
      return;
    }
    if (isDuties && !dutyType) {
      Alert.alert('Required', 'Please select a duty/tax type.');
      return;
    }
    if (!isPaired) {
      Toast.show({ type: 'error', text1: 'Not Paired', text2: 'Please pair with Tally Desktop first.' });
      return;
    }

    try {
      setSubmitting(true);

      // Base payload
      const payload: Record<string, any> = {
        companyGuid: company?.guid,
        companyName: company?.name,
        name:             name.trim(),
        ledger_type:      lType,
        openingBalance:  parseFloat(openBalance) || 0,
        isCr:             isCr,
        parent:           cfg.group || customGroup || undefined,
      };

      // Party-specific fields from PartyForm
      if (isParty) {
        const pd = formRef.current?.getData();
        if (pd) {
          const address = [pd.addressLine1, pd.addressLine2].filter(Boolean).join('\n');
          Object.assign(payload, {
            phone:       pd.phone,
            email:       pd.email,
            website:     pd.website,
            address,
            state:       pd.state,
            country:     pd.country || 'India',
            pincode:     pd.pincode,
            mailingName: name.trim(),
            gstRegType:  pd.gstRegType,
            gstin:       pd.gstin,
            pan:         pd.pan,
            vatDetails: pd.vatEnabled ? {
              dealerType:      pd.vatDealerType,
              vatTin:          pd.vatTin,
              cstNo:           pd.cstNo,
              formCApplicable: pd.formCApplicable,
            } : undefined,
            bankDetails: pd.bankEnabled ? {
              beneficiaryName: pd.bankBeneficiaryName,
              bankName:        pd.bankName,
              accountNo:       pd.bankAccountNo,
              ifsc:            pd.bankIfsc,
              branch:          pd.bankBranch,
            } : undefined,
          });
        }
      }

      await createLedger(payload);

      Toast.show({ type: 'success', text1: 'Ledger Created', text2: `"${name}" added to Tally.` });
      setTimeout(() => router.back(), 1200);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Failed', text2: err?.message || 'Could not create ledger.' });
    } finally {
      setSubmitting(false);
    }
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

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={s.form}
        >
          {/* ── Name ── */}
          <Text style={s.label}>Name <Text style={s.required}>*</Text></Text>
          <ThemedInput placeholder="Enter ledger name" value={name} onChangeText={setName} />

          {/* ── Custom group search ── */}
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
            value={openBalance} onChange={setOpenBalance}
            isCr={isCr} onToggleCr={setIsCr}
          />

          {/* ── Duties & Taxes ── */}
          {isDuties && (
            <View style={s.row2}>
              <View style={{ flex: 1 }}>
                <FormDropdown
                  label="Type of Duty / Tax"
                  required
                  value={dutyType}
                  options={DUTY_TYPES.map(d => ({ label: d, value: d }))}
                  placeholder="Select type"
                  onSelect={o => setDutyType(o.value)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.label, { marginTop: 0, marginBottom: 6 }]}>
                  % of Calculation <Text style={s.required}>*</Text>
                </Text>
                <View style={s.percentBox}>
                  <TextInput
                    style={[s.percentInput, Platform.select({ web: { outlineWidth: 0, outlineStyle: 'none' } as any })]}
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

          {/* ── Party Fields (Sundry Debtor / Creditor) ── */}
          {isParty && (
            <>
              <View style={s.divider} />
              <PartyForm ref={formRef} />
            </>
          )}

          <View style={{ height: 20 }} />
        </ScrollView>

        {/* ── Save Button ── */}
        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity
            style={[s.saveBtn, submitting && { opacity: 0.6 }]}
            onPress={handleSave}
            activeOpacity={0.85}
            disabled={submitting}
          >
            {submitting && <ActivityIndicator size="small" color={COLORS.white} style={{ marginRight: 8 }} />}
            <Text style={s.saveBtnText}>{submitting ? 'Saving...' : 'Save Ledger'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.cardBg,
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },

  form: { padding: SPACING.md },
  label: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, marginBottom: 8, marginTop: 18 },
  required: { color: COLORS.negative },

  input: {
    borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, backgroundColor: COLORS.cardBg,
  },
  inputFocused: { borderColor: COLORS.brandPrimary, borderWidth: 1.5 },

  balanceBox: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md,
    backgroundColor: COLORS.cardBg, paddingLeft: 14, paddingRight: 10, paddingVertical: 4,
  },
  balanceBoxFocused: { borderColor: COLORS.brandPrimary, borderWidth: 1.5 },
  balanceInput: { flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, paddingVertical: 9 },
  drCrWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 8 },
  drCrLabel: { fontSize: TYPOGRAPHY.sm, fontWeight: '500', color: COLORS.textTertiary },
  drCrLabelActive: { color: COLORS.textPrimary, fontWeight: '700' },

  row2: { flexDirection: 'row', gap: SPACING.sm, marginTop: 18 },

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
    paddingHorizontal: 14, paddingVertical: 13,
    borderLeftWidth: 1, borderLeftColor: COLORS.borderDefault,
    backgroundColor: COLORS.pageBg,
  },
  percentSuffixText: { fontSize: TYPOGRAPHY.base, color: COLORS.textSecondary, fontWeight: '600' },

  divider: { height: 1, backgroundColor: COLORS.borderDefault, marginVertical: 8 },

  footer: {
    paddingHorizontal: SPACING.md, paddingTop: 12,
    backgroundColor: COLORS.cardBg,
    borderTopWidth: 1, borderTopColor: COLORS.borderDefault,
  },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md,
    paddingVertical: 16,
  },
  saveBtnText: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});
