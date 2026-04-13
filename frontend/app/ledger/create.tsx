import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import FormField from '../../src/components/forms/FormField';
import FormDropdown, { DropdownOption } from '../../src/components/forms/FormDropdown';
import RegularOptionalToggle, { EntryType } from '../../src/components/forms/RegularOptionalToggle';

// ─── All Tally Predefined Groups ─────────────────────────────────────────────
const TALLY_GROUPS: DropdownOption[] = [
  { label: 'Capital Account', value: 'capital_account' },
  { label: 'Reserves & Surplus', value: 'reserves_surplus' },
  { label: 'Sundry Creditors', value: 'sundry_creditors' },
  { label: 'Sundry Debtors', value: 'sundry_debtors' },
  { label: 'Bank Accounts', value: 'bank_accounts' },
  { label: 'Bank OD Accounts', value: 'bank_od' },
  { label: 'Cash-in-Hand', value: 'cash_in_hand' },
  { label: 'Duties & Taxes', value: 'duties_taxes' },
  { label: 'Fixed Assets', value: 'fixed_assets' },
  { label: 'Investments', value: 'investments' },
  { label: 'Loans & Advances (Asset)', value: 'loans_advances_asset' },
  { label: 'Loans (Liability)', value: 'loans_liability' },
  { label: 'Secured Loans', value: 'secured_loans' },
  { label: 'Unsecured Loans', value: 'unsecured_loans' },
  { label: 'Current Assets', value: 'current_assets' },
  { label: 'Current Liabilities', value: 'current_liabilities' },
  { label: 'Provisions', value: 'provisions' },
  { label: 'Deposits (Asset)', value: 'deposits_asset' },
  { label: 'Stock-in-Hand', value: 'stock_in_hand' },
  { label: 'Sales Accounts', value: 'sales_accounts' },
  { label: 'Purchase Accounts', value: 'purchase_accounts' },
  { label: 'Direct Expenses', value: 'direct_expenses' },
  { label: 'Indirect Expenses', value: 'indirect_expenses' },
  { label: 'Direct Income', value: 'direct_income' },
  { label: 'Indirect Income', value: 'indirect_income' },
  { label: 'Misc. Expenses (Asset)', value: 'misc_expenses' },
  { label: 'Work in Progress', value: 'wip' },
  { label: 'Expenses Payable', value: 'expenses_payable' },
];

const BALANCE_TYPES: DropdownOption[] = [
  { label: 'Debit (Dr)', value: 'dr' },
  { label: 'Credit (Cr)', value: 'cr' },
];
const DUTY_TYPES: DropdownOption[] = [
  { label: 'CGST', value: 'cgst' },
  { label: 'SGST', value: 'sgst' },
  { label: 'IGST', value: 'igst' },
  { label: 'CESS', value: 'cess' },
  { label: 'TDS', value: 'tds' },
  { label: 'TCS', value: 'tcs' },
  { label: 'Service Tax', value: 'service_tax' },
  { label: 'Custom Duty', value: 'custom_duty' },
  { label: 'Other', value: 'other' },
];
const GST_RATES: DropdownOption[] = [
  { label: '0%', value: '0' },
  { label: '5%', value: '5' },
  { label: '12%', value: '12' },
  { label: '18%', value: '18' },
  { label: '28%', value: '28' },
];

type LedgerType = 'sundry_creditor' | 'sundry_debtor' | 'duties_taxes' | 'custom';

const TYPE_CONFIG: Record<LedgerType, { title: string; group: string; color: string; bg: string; icon: string }> = {
  sundry_creditor: { title: 'Add Sundry Creditor', group: 'Sundry Creditors', color: COLORS.negative, bg: COLORS.negativeBg, icon: 'arrow-up-circle-outline' },
  sundry_debtor:   { title: 'Add Sundry Debtor',   group: 'Sundry Debtors',   color: COLORS.positive, bg: COLORS.positiveBg, icon: 'arrow-down-circle-outline' },
  duties_taxes:    { title: 'Add Duties & Taxes',   group: 'Duties & Taxes',   color: COLORS.warning,  bg: COLORS.warningBg,  icon: 'receipt-outline' },
  custom:          { title: 'Add Custom Ledger',    group: '',                 color: COLORS.info,     bg: COLORS.infoBg,     icon: 'journal-outline' },
};

export default function CreateLedgerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ type?: string }>();
  const [entryType, setEntryType] = useState<EntryType>('regular');

  const lType = ((['sundry_creditor','sundry_debtor','duties_taxes','custom'].includes(params.type||'') ? params.type : 'custom') as LedgerType);
  const cfg = TYPE_CONFIG[lType];

  // Common fields
  const [name, setName] = useState('');
  const [group, setGroup] = useState(lType !== 'custom' ? 'auto' : '');
  const [openBalance, setOpenBalance] = useState('');
  const [balanceType, setBalanceType] = useState('cr');
  const [narration, setNarration] = useState('');

  // Party fields (creditor/debtor)
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [address, setBillingAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [creditDays, setCreditDays] = useState('');

  // Duties & taxes fields
  const [dutyType, setDutyType] = useState('');
  const [gstRate, setGstRate] = useState('');
  const [gstCode, setGstCode] = useState('');

  // Custom group
  const [customGroup, setCustomGroup] = useState('');

  const handleSave = () => {
    if (!name.trim()) { Alert.alert('Error', 'Ledger name is required.'); return; }
    Alert.alert('✓ Ledger Created', `"${name}" has been added successfully.`, [{ text: 'OK', onPress: () => router.back() }]);
  };

  const isParty = lType === 'sundry_creditor' || lType === 'sundry_debtor';

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{cfg.title}</Text>
        <RegularOptionalToggle value={entryType} onChange={setEntryType} />
      </View>

      {/* Type Banner */}
      <View style={[s.typeBanner, { backgroundColor: cfg.bg, borderColor: cfg.color + '40' }]}>
        <View style={[s.typeIcon, { backgroundColor: cfg.color + '20' }]}>
          <Ionicons name={cfg.icon as any} size={18} color={cfg.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.typeTitle, { color: cfg.color }]}>{cfg.title}</Text>
          {cfg.group !== '' && (
            <Text style={s.typeGroup}>Under: <Text style={{ fontWeight: '700' }}>{cfg.group}</Text></Text>
          )}
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* Common - Ledger Name + Group */}
          <View style={s.card}>
            <View style={s.cardHdr}><Ionicons name="journal-outline" size={18} color={COLORS.brandPrimary} /><Text style={s.cardTitle}>Ledger Details</Text></View>
            <FormField label="Ledger Name" value={name} onChangeText={setName} placeholder="e.g. ABC Traders" required />

            {lType === 'custom' ? (
              <FormDropdown
                label="Under Group" value={customGroup} options={TALLY_GROUPS}
                onSelect={o => setCustomGroup(o.value)} placeholder="Select Tally group..." required
              />
            ) : (
              <View style={s.groupChip}>
                <Ionicons name="folder-outline" size={14} color={cfg.color} />
                <Text style={[s.groupChipTxt, { color: cfg.color }]}>Group: {cfg.group}</Text>
                <Ionicons name="lock-closed-outline" size={12} color={COLORS.textTertiary} />
              </View>
            )}

            <View style={s.row2}>
              <View style={{ flex: 1 }}>
                <FormField label="Opening Balance (₹)" value={openBalance} onChangeText={setOpenBalance}
                  keyboardType="numeric" placeholder="0.00" containerStyle={{ marginBottom: 0 }} />
              </View>
              <View style={{ flex: 1 }}>
                <FormDropdown label="Balance Type" value={balanceType} options={BALANCE_TYPES}
                  onSelect={o => setBalanceType(o.value)} placeholder="Dr / Cr" containerStyle={{ marginBottom: 0 }} />
              </View>
            </View>
          </View>

          {/* Party fields - for creditor / debtor */}
          {isParty && (
            <View style={s.card}>
              <View style={s.cardHdr}><Ionicons name="person-outline" size={18} color={COLORS.info} /><Text style={s.cardTitle}>Party Details</Text></View>
              <View style={s.row2}>
                <View style={{ flex: 1 }}>
                  <FormField label="Contact No." value={contact} onChangeText={setContact} keyboardType="phone-pad" placeholder="10-digit" containerStyle={{ marginBottom: 0 }} />
                </View>
                <View style={{ flex: 1 }}>
                  <FormField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="Optional" containerStyle={{ marginBottom: 0 }} />
                </View>
              </View>
              <FormField label="Billing Address" value={address} onChangeText={setBillingAddress}
                placeholder="Full address" multiline numberOfLines={2}
                style={{ minHeight: 64, textAlignVertical: 'top' } as any}
                containerStyle={{ marginTop: SPACING.md }} />
              <View style={s.row2}>
                <View style={{ flex: 1 }}>
                  <FormField label="GSTIN" value={gstin} onChangeText={v => setGstin(v.toUpperCase())}
                    placeholder="15-digit GSTIN" autoCapitalize="characters" containerStyle={{ marginBottom: 0 }} />
                </View>
                <View style={{ flex: 1 }}>
                  <FormField label="PAN" value={pan} onChangeText={v => setPan(v.toUpperCase())}
                    placeholder="10-char PAN" autoCapitalize="characters" containerStyle={{ marginBottom: 0 }} />
                </View>
              </View>
              <View style={[s.row2, { marginTop: SPACING.md }]}>
                <View style={{ flex: 1 }}>
                  <FormField label="Credit Limit (₹)" value={creditLimit} onChangeText={setCreditLimit}
                    keyboardType="numeric" placeholder="0 = unlimited" containerStyle={{ marginBottom: 0 }} />
                </View>
                <View style={{ flex: 1 }}>
                  <FormField label="Credit Period (Days)" value={creditDays} onChangeText={setCreditDays}
                    keyboardType="numeric" placeholder="e.g. 30" containerStyle={{ marginBottom: 0 }} />
                </View>
              </View>
            </View>
          )}

          {/* Duties & Taxes specific */}
          {lType === 'duties_taxes' && (
            <View style={s.card}>
              <View style={s.cardHdr}><Ionicons name="receipt-outline" size={18} color={COLORS.warning} /><Text style={s.cardTitle}>Tax Configuration</Text></View>
              <FormDropdown label="Tax / Duty Type" value={dutyType} options={DUTY_TYPES}
                onSelect={o => setDutyType(o.value)} placeholder="Select type..." required />
              <View style={s.row2}>
                <View style={{ flex: 1 }}>
                  <FormDropdown label="GST Rate" value={gstRate} options={GST_RATES}
                    onSelect={o => setGstRate(o.value)} placeholder="Select %" containerStyle={{ marginBottom: 0 }} />
                </View>
                <View style={{ flex: 1 }}>
                  <FormField label="GST / Tax Code" value={gstCode} onChangeText={setGstCode}
                    placeholder="e.g. GST18" autoCapitalize="characters" containerStyle={{ marginBottom: 0 }} />
                </View>
              </View>
            </View>
          )}

          {/* Narration */}
          <View style={s.card}>
            <FormField label="Narration / Notes" value={narration} onChangeText={setNarration}
              placeholder="Optional internal notes..." multiline numberOfLines={2}
              style={{ minHeight: 60, textAlignVertical: 'top' } as any} containerStyle={{ marginBottom: 0 }} />
          </View>
        </ScrollView>

        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TouchableOpacity style={[s.submitBtn, { backgroundColor: cfg.color }]} onPress={handleSave} activeOpacity={0.7}>
            <Ionicons name="add-circle" size={18} color={COLORS.white} />
            <Text style={s.submitTxt}>Create Ledger</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  typeBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: SPACING.md, paddingVertical: 12, borderBottomWidth: 1 },
  typeIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  typeTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '700' },
  typeGroup: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  scroll: { padding: SPACING.md, paddingBottom: 8 },
  card: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  cardHdr: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.md },
  cardTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  groupChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  groupChipTxt: { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '600' },
  row2: { flexDirection: 'row', gap: 12 },
  footer: { paddingHorizontal: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg },
  submitBtn: { flexDirection: 'row', gap: 8, paddingVertical: 14, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  submitTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});
