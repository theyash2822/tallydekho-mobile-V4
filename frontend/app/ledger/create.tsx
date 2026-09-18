import React, { useState, useRef, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, TextInput, TextInputProps,
  ActivityIndicator, Keyboard,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { useWorkspace } from '../../src/context/WorkspaceContext';
import { createLedger } from '../../src/services/api';
import FormDropdown from '../../src/components/forms/FormDropdown';
import BottomSheetSearch from '../../src/components/forms/BottomSheetSearch';
import BrandSwitch from '../../src/components/forms/BrandSwitch';
import PartyForm, { PartyFormRef } from '../../src/components/forms/PartyForm';
import { useRequireCapability } from '../../src/components/RequireCapability';
import { useRbasCreate } from '../../src/hooks/useRbasCreate';

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
type CustomProfile = 'simple' | 'bank' | 'tradingGst' | 'pnlGst' | '';

const TYPE_CONFIG: Record<LedgerType, { title: string; group: string }> = {
  sundry_creditor: { title: 'Sundry Creditors', group: 'Sundry Creditors' },
  sundry_debtor:   { title: 'Sundry Debtors',   group: 'Sundry Debtors' },
  duties_taxes:    { title: 'Duties & Taxes',    group: 'Duties & Taxes' },
  custom:          { title: 'Custom Groups',     group: '' },
};

const DUTY_CATEGORIES = ['GST', 'CST', 'VAT', 'Others'] as const;
const GST_TAX_TYPES     = ['IGST', 'CGST', 'SGST/UTGST', 'Cess'] as const;
const OTHER_TAX_TYPES   = ['VAT', 'Not Applicable'] as const;

/** Locked Custom Groups Under list — Tally-exact spellings only. */
const CUSTOM_GROUPS = [
  'Cash-in-hand',
  'Bank Accounts',
  'Bank OD A/c',
  'Fixed Assets',
  'Investments',
  'Deposits (Asset)',
  'Loans & Advances (Asset)',
  'Current Assets',
  'Capital Account',
  'Reserves & Surplus',
  'Secured Loans',
  'Unsecured Loans',
  'Current Liabilities',
  'Provisions',
  'Sales Accounts',
  'Purchase Accounts',
  'Direct Expenses',
  'Indirect Expenses',
  'Direct Incomes',
  'Indirect Incomes',
] as const;

const DEFAULT_CR_GROUPS = new Set([
  'Capital Account',
  'Reserves & Surplus',
  'Secured Loans',
  'Unsecured Loans',
  'Current Liabilities',
  'Provisions',
  'Bank OD A/c',
]);

const HIDE_OB_GROUPS = new Set([
  'Sales Accounts',
  'Purchase Accounts',
  'Direct Expenses',
  'Indirect Expenses',
  'Direct Incomes',
  'Indirect Incomes',
]);

const BANK_GROUPS = new Set(['Bank Accounts', 'Bank OD A/c']);
const TRADING_GST_GROUPS = new Set(['Sales Accounts', 'Purchase Accounts']);
const PNL_GST_GROUPS = new Set([
  'Direct Expenses', 'Indirect Expenses', 'Direct Incomes', 'Indirect Incomes',
]);

function profileForGroup(group: string): CustomProfile {
  if (!group) return '';
  if (BANK_GROUPS.has(group)) return 'bank';
  if (TRADING_GST_GROUPS.has(group)) return 'tradingGst';
  if (PNL_GST_GROUPS.has(group)) return 'pnlGst';
  return 'simple';
}

const GST_APPLICABILITY_OPTS = [
  { label: 'Applicable', value: 'Applicable' },
  { label: 'Not Applicable', value: 'Not Applicable' },
];
const TYPE_OF_SUPPLY_OPTS = [
  { label: 'Goods', value: 'Goods' },
  { label: 'Services', value: 'Services' },
];
const TAXABILITY_OPTS = [
  { label: 'Taxable', value: 'Taxable' },
  { label: 'Exempt', value: 'Exempt' },
  { label: 'Nil Rated', value: 'Nil Rated' },
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
  const allowed = useRequireCapability('ledger_master.create');
  const router      = useRouter();
  const insets      = useSafeAreaInsets();
  const params      = useLocalSearchParams<{ type?: string }>();
  const { company } = useAuth();
  const { pairingStatus } = useWorkspace();
  const { assertCanCreate } = useRbasCreate();

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
  const [name,        setName]        = useState('');
  const [openBalance, setOpenBalance] = useState('');
  const [isCr,        setIsCr]        = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [submitResult, setSubmitResult] = useState<{ queueId: number | string; isQueued: boolean; name: string } | null>(null);

  // ── Custom group
  const [customGroup, setCustomGroup] = useState('');

  // ── Bank (Custom → Bank Accounts / Bank OD A/c)
  const [bankAccountNo, setBankAccountNo] = useState('');
  const [bankIfsc,      setBankIfsc]      = useState('');
  const [bankBranch,    setBankBranch]    = useState('');
  const [bankHolder,    setBankHolder]    = useState('');
  const [bankName,      setBankName]      = useState('');

  // ── Duties & Taxes
  const [dutyCategory, setDutyCategory] = useState('');
  const [taxType,      setTaxType]      = useState('');
  const [percentage,   setPercentage]   = useState('');

  // ── Trading / P&L GST (Custom)
  const [gstApplicable, setGstApplicable] = useState('');
  const [typeOfSupply,  setTypeOfSupply]  = useState('');
  const [taxability,    setTaxability]    = useState('');
  const [hsnCode,       setHsnCode]       = useState('');
  const [gstRate,       setGstRate]       = useState('');

  const showTaxType = dutyCategory === 'GST' || dutyCategory === 'Others';
  const taxTypeOptions = dutyCategory === 'GST'
    ? GST_TAX_TYPES
    : dutyCategory === 'Others'
      ? OTHER_TAX_TYPES
      : [];

  const formRef = useRef<PartyFormRef>(null);

  const customProfile = useMemo(
    () => (isCustom ? profileForGroup(customGroup) : ''),
    [isCustom, customGroup],
  );
  const showOpeningBalance = !isCustom || !HIDE_OB_GROUPS.has(customGroup);
  const isBankProfile = customProfile === 'bank';
  const isGstProfile  = customProfile === 'tradingGst' || customProfile === 'pnlGst';
  const showTypeOfSupply = isGstProfile && (
    customProfile === 'tradingGst'
    || customGroup === 'Direct Incomes'
    || customGroup === 'Indirect Incomes'
  );
  const gstDetailsVisible = isGstProfile && gstApplicable === 'Applicable';

  const onSelectCustomGroup = (group: string) => {
    setCustomGroup(group);
    setIsCr(DEFAULT_CR_GROUPS.has(group));
    if (HIDE_OB_GROUPS.has(group)) setOpenBalance('');
    // Reset profile-specific fields when Under changes
    setBankAccountNo(''); setBankIfsc(''); setBankBranch(''); setBankHolder(''); setBankName('');
    setGstApplicable(''); setTypeOfSupply(''); setTaxability(''); setHsnCode(''); setGstRate('');
  };

  // ─── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Ledger name is required.');
      return;
    }
    if (isCustom && !customGroup) {
      Alert.alert('Required', 'Please select Under (Group).');
      return;
    }
    if (isDuties && !dutyCategory) {
      Alert.alert('Required', 'Please select Type of Duty / Tax.');
      return;
    }
    if (isDuties && showTaxType && !taxType) {
      Alert.alert('Required', 'Please select Tax type.');
      return;
    }
    if (isGstProfile && !gstApplicable) {
      Alert.alert('Required', 'Please select GST Applicability.');
      return;
    }
    if (gstDetailsVisible && !taxability) {
      Alert.alert('Required', 'Please select Taxability.');
      return;
    }
    if (gstDetailsVisible && showTypeOfSupply && !typeOfSupply) {
      Alert.alert('Required', 'Please select Type of Supply.');
      return;
    }
    if (String(pairingStatus || '').toUpperCase() !== 'CONNECTED') {
      Toast.show({ type: 'error', text1: 'Tally not connected', text2: 'Connect and sync Tally before creating masters.' });
      return;
    }
    if (!assertCanCreate('ledger_master.create')) return;

    try {
      setSubmitting(true);

      const payload: Record<string, any> = {
        companyGuid: company?.guid,
        companyName: company?.name,
        name:            name.trim(),
        ledger_type:     lType,
        openingBalance:  showOpeningBalance ? (parseFloat(openBalance) || 0) : 0,
        isCr,
        parent:          cfg.group || customGroup || undefined,
        isBillWise:      isParty ? 'Yes' : 'No',
      };

      if (isDuties) {
        Object.assign(payload, {
          dutyCategory,
          taxType: showTaxType ? taxType : undefined,
          percentage: parseFloat(percentage) || 0,
        });
      }

      if (isBankProfile) {
        Object.assign(payload, {
          bankDetails: {
            accountNo:        bankAccountNo.trim() || undefined,
            ifsc:             bankIfsc.trim().toUpperCase() || undefined,
            branch:           bankBranch.trim() || undefined,
            beneficiaryName:  bankHolder.trim() || undefined,
            bankName:         bankName.trim() || undefined,
          },
        });
      }

      if (isGstProfile) {
        const rate = parseFloat(gstRate) || 0;
        Object.assign(payload, {
          gstApplicable,
          typeOfSupply: showTypeOfSupply ? typeOfSupply : undefined,
          taxability: gstDetailsVisible ? taxability : undefined,
          hsnCode: gstDetailsVisible ? hsnCode.trim() : undefined,
          igstRate: gstDetailsVisible ? rate : 0,
          cgstRate: gstDetailsVisible ? rate / 2 : 0,
          sgstRate: gstDetailsVisible ? rate / 2 : 0,
          inventoryValuesAffected: customProfile === 'tradingGst' ? 'No' : undefined,
        });
      }

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
          });
        }
      }

      const res: any = await createLedger(payload);
      const queueId = res?.queueId ?? res?.data?.queueId;
      const isQueued = !!(res?.queued);

      if (queueId) {
        setSubmitResult({ queueId, isQueued, name: name.trim() });
      } else {
        Toast.show({ type: 'success', text1: 'Ledger Created', text2: `"${name}" added to Tally.` });
        setTimeout(() => router.back(), 1200);
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Failed', text2: err?.message || 'Could not create ledger.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitResult) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <View style={ss.overlay}>
          <View style={ss.card}>
            <View style={ss.iconWrap}>
              <Ionicons
                name={submitResult.isQueued ? 'time-outline' : 'checkmark-circle'}
                size={56}
                color={submitResult.isQueued ? COLORS.warning : COLORS.positive}
              />
            </View>
            <Text style={ss.title}>
              {submitResult.isQueued ? 'Saved. Pending Sync' : 'Ledger Created!'}
            </Text>
            <Text style={ss.sub}>
              {submitResult.isQueued
                ? 'Entry queued. Will push to Tally when desktop reconnects.'
                : `"${submitResult.name}" pushed to Tally successfully.`}
            </Text>
            <TouchableOpacity
              style={ss.previewBtn}
              activeOpacity={0.85}
              onPress={() => {
                router.replace(`/masters/preview?queueId=${encodeURIComponent(String(submitResult.queueId))}` as any);
              }}
            >
              <Ionicons name="eye-outline" size={18} color={COLORS.brandPrimary} />
              <Text style={ss.previewBtnTxt}>Preview</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={ss.doneBtn}
              activeOpacity={0.85}
              onPress={() => router.back()}
            >
              <Text style={ss.doneBtnTxt}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!allowed) return null;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{cfg.title}</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={Keyboard.dismiss}
          contentContainerStyle={[s.form, { paddingBottom: 32 }]}
        >
          {/* ── Name ── */}
          <View style={s.field}>
            <Text style={s.label}>Name <Text style={s.required}>*</Text></Text>
            <ThemedInput placeholder="Enter ledger name" value={name} onChangeText={setName} />
          </View>

          {/* ── Custom: Under first (bottom sheet + search) ── */}
          {isCustom && (
            <BottomSheetSearch
              label="Under (Group)"
              required
              placeholder="Select group first..."
              sheetTitle="Under (Group)"
              searchPlaceholder="Search groups..."
              options={CUSTOM_GROUPS.map(g => ({ label: g, value: g }))}
              value={customGroup}
              onSelect={o => onSelectCustomGroup(o.value)}
              onClear={() => onSelectCustomGroup('')}
              icon="folder-outline"
            />
          )}

          {isCustom && customGroup === 'Bank OD A/c' && (
            <Text style={s.helper}>
              Use Bank OD A/c only for overdraft / cash-credit / loan-type bank accounts.
              For a normal bank account, use Bank Accounts.
            </Text>
          )}

          {/* ── Opening Balance (hidden for P&L Custom groups) ── */}
          {showOpeningBalance && (
            <View style={s.field}>
              <Text style={s.label}>Opening Balance</Text>
              <BalanceRow
                value={openBalance} onChange={setOpenBalance}
                isCr={isCr} onToggleCr={setIsCr}
              />
            </View>
          )}

          {/* ── Bank fields (Custom → Bank / Bank OD) ── */}
          {isBankProfile && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Bank Details</Text>
              <View style={s.field}>
                <Text style={s.label}>Account Number</Text>
                <ThemedInput
                  placeholder="Account number"
                  value={bankAccountNo}
                  onChangeText={setBankAccountNo}
                  keyboardType="number-pad"
                />
              </View>
              <View style={s.field}>
                <Text style={s.label}>IFSC Code</Text>
                <ThemedInput
                  placeholder="IFSC"
                  value={bankIfsc}
                  onChangeText={t => setBankIfsc(t.toUpperCase())}
                  autoCapitalize="characters"
                />
              </View>
              <View style={s.field}>
                <Text style={s.label}>Branch</Text>
                <ThemedInput placeholder="Branch name" value={bankBranch} onChangeText={setBankBranch} />
              </View>
              <View style={s.field}>
                <Text style={s.label}>Account Holder Name</Text>
                <ThemedInput placeholder="Account holder" value={bankHolder} onChangeText={setBankHolder} />
              </View>
              <View style={s.field}>
                <Text style={s.label}>Bank Name</Text>
                <ThemedInput placeholder="Bank name" value={bankName} onChangeText={setBankName} />
              </View>
            </View>
          )}

          {/* ── GST block (Custom → Sales / Purchase / Income / Expense) ── */}
          {isGstProfile && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>GST Details</Text>
              <FormDropdown
                label="GST Applicability"
                required
                value={gstApplicable}
                options={GST_APPLICABILITY_OPTS}
                placeholder="Select"
                onSelect={o => {
                  setGstApplicable(o.value);
                  if (o.value !== 'Applicable') {
                    setTypeOfSupply(''); setTaxability(''); setHsnCode(''); setGstRate('');
                  }
                }}
              />
              {gstDetailsVisible && showTypeOfSupply && (
                <FormDropdown
                  label="Type of Supply"
                  required
                  value={typeOfSupply}
                  options={TYPE_OF_SUPPLY_OPTS}
                  placeholder="Select"
                  onSelect={o => setTypeOfSupply(o.value)}
                />
              )}
              {gstDetailsVisible && (
                <>
                  <FormDropdown
                    label="Taxability"
                    required
                    value={taxability}
                    options={TAXABILITY_OPTS}
                    placeholder="Select"
                    onSelect={o => setTaxability(o.value)}
                  />
                  <View style={s.field}>
                    <Text style={s.label}>HSN / SAC</Text>
                    <ThemedInput
                      placeholder="HSN or SAC code"
                      value={hsnCode}
                      onChangeText={setHsnCode}
                      autoCapitalize="characters"
                    />
                  </View>
                  <View style={s.field}>
                    <Text style={s.label}>GST Rate %</Text>
                    <View style={s.percentBox}>
                      <TextInput
                        style={[s.percentInput, Platform.select({ web: { outlineWidth: 0, outlineStyle: 'none' } as any })]}
                        placeholder="0"
                        placeholderTextColor={COLORS.textTertiary}
                        value={gstRate}
                        onChangeText={setGstRate}
                        keyboardType="decimal-pad"
                      />
                      <View style={s.percentSuffix}>
                        <Text style={s.percentSuffixText}>%</Text>
                      </View>
                    </View>
                  </View>
                </>
              )}
            </View>
          )}

          {/* ── Duties & Taxes (dedicated tile) ── */}
          {isDuties && (
            <View style={s.section}>
              <FormDropdown
                label="Type of Duty / Tax"
                required
                value={dutyCategory}
                options={DUTY_CATEGORIES.map(d => ({ label: d, value: d }))}
                placeholder="Select type"
                onSelect={o => {
                  setDutyCategory(o.value);
                  setTaxType('');
                }}
              />

              {showTaxType && (
                <FormDropdown
                  label="Tax type"
                  required
                  value={taxType}
                  options={taxTypeOptions.map(t => ({ label: t, value: t }))}
                  placeholder="Select tax type"
                  onSelect={o => setTaxType(o.value)}
                />
              )}

              <View style={s.field}>
                <Text style={s.label}>% of Calculation</Text>
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

          {/* ── Party Fields (Sundry Debtor / Creditor dedicated tiles) ── */}
          {isParty && (
            <>
              <View style={s.divider} />
              <PartyForm ref={formRef} />
            </>
          )}
        </ScrollView>

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
  // One spacing contract: label → control gap 6, field block gap md
  field: { marginBottom: SPACING.md },
  label: {
    fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6,
  },
  required: { color: COLORS.negative },
  section: { marginTop: 8 },
  sectionTitle: {
    fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary,
    marginBottom: 12,
  },
  helper: {
    fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary,
    marginTop: -4, marginBottom: SPACING.md, lineHeight: 18,
  },

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

  divider: { height: 1, backgroundColor: COLORS.borderDefault, marginVertical: SPACING.md },

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

const ss = StyleSheet.create({
  overlay: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: SPACING.lg, backgroundColor: COLORS.pageBg,
  },
  card: {
    width: '100%', maxWidth: 400, backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg, padding: 24, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  iconWrap: { marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center' },
  sub: {
    marginTop: 8, fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary,
    textAlign: 'center', lineHeight: 20, marginBottom: 20,
  },
  previewBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: COLORS.brandPrimary, borderRadius: RADIUS.md,
    paddingVertical: 13, width: '100%', marginBottom: 10,
  },
  previewBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.brandPrimary },
  doneBtn: {
    backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md,
    paddingVertical: 13, width: '100%', alignItems: 'center',
  },
  doneBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});
