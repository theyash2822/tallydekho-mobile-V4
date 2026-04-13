import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, TextInput, Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import FormField from '../../src/components/forms/FormField';
import FormDropdown, { DropdownOption } from '../../src/components/forms/FormDropdown';

type VType = 'payment' | 'receipt' | 'journal' | 'contra';

const VTYPES = [
  { key: 'payment' as VType, label: 'Payment', color: '#C0392B', bg: '#FDECEA', icon: 'arrow-up-circle-outline' },
  { key: 'receipt' as VType, label: 'Receipt', color: '#2D7D46', bg: '#F0FBF4', icon: 'arrow-down-circle-outline' },
  { key: 'journal' as VType, label: 'Journal', color: '#2563EB', bg: '#EFF6FF', icon: 'book-outline' },
  { key: 'contra' as VType, label: 'Contra', color: '#7C3AED', bg: '#F5F3FF', icon: 'swap-horizontal-outline' },
];

const PARTIES: DropdownOption[] = [
  { label: 'ABC Traders', value: 'abc_traders' },
  { label: 'PQR Exports', value: 'pqr_exports' },
  { label: 'Kumar & Sons', value: 'kumar_sons' },
  { label: 'XYZ Retail', value: 'xyz_retail' },
  { label: 'Sharma Electronics', value: 'sharma_elec' },
  { label: 'Delhi Suppliers', value: 'delhi_suppliers' },
  { label: 'Raj Enterprises', value: 'raj_ent' },
  { label: 'Indian Export House', value: 'ind_export' },
];

const ACCOUNTS: DropdownOption[] = [
  { label: 'Cash', value: 'cash' },
  { label: 'HDFC Bank - Current', value: 'hdfc_current' },
  { label: 'SBI - Savings', value: 'sbi_savings' },
  { label: 'ICICI Bank - Current', value: 'icici_current' },
];

const LEDGERS: DropdownOption[] = [
  { label: 'Cash', value: 'cash' },
  { label: 'HDFC Bank', value: 'hdfc' },
  { label: 'SBI Bank', value: 'sbi' },
  { label: 'ICICI Bank', value: 'icici' },
  { label: 'Sundry Debtors', value: 'sundry_debtors' },
  { label: 'Sundry Creditors', value: 'sundry_creditors' },
  { label: 'Purchase - Raw Materials', value: 'purchase_raw' },
  { label: 'Sales - Goods', value: 'sales_goods' },
  { label: 'Office Expenses', value: 'office_exp' },
  { label: 'Bank Interest', value: 'bank_interest' },
  { label: 'Rent Expense', value: 'rent_expense' },
  { label: 'Depreciation A/c', value: 'depreciation' },
  { label: 'Capital Account', value: 'capital' },
];

const PMODES: DropdownOption[] = [
  { label: 'Cash', value: 'cash' },
  { label: 'NEFT', value: 'neft' },
  { label: 'RTGS', value: 'rtgs' },
  { label: 'Cheque', value: 'cheque' },
  { label: 'UPI', value: 'upi' },
];

const CONTRA_MODES: DropdownOption[] = [
  { label: 'Cash', value: 'cash' },
  { label: 'Online Transfer', value: 'online' },
  { label: 'Cheque', value: 'cheque' },
];

const AUTO_NOS: Record<VType, string> = {
  payment: 'PAY-00013',
  receipt: 'RCPT-00046',
  journal: 'JNL-00090',
  contra: 'CTR-00025',
};

const todayStr = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(-2)}`;
};

export default function CreateVoucherScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const insets = useSafeAreaInsets();

  const initType = (['payment','receipt','journal','contra'].includes(params.type || '') ? params.type : 'payment') as VType;
  const [vType, setVType] = useState<VType>(initType);
  const [date, setDate] = useState(todayStr());

  // Payment / Receipt
  const [party, setParty] = useState('');
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('');
  const [bank, setBank] = useState('');
  const [refNo, setRefNo] = useState('');
  const [narration, setNarration] = useState('');

  // Journal
  const [drLedger, setDrLedger] = useState('');
  const [crLedger, setCrLedger] = useState('');

  // Contra
  const [fromLedger, setFromLedger] = useState('');
  const [toLedger, setToLedger] = useState('');
  const [contraMode, setContraMode] = useState('');

  const cfg = VTYPES.find(v => v.key === vType)!;
  const isCash = mode === 'cash';

  const parsedAmount = useMemo(() => {
    const n = parseFloat(amount.replace(/,/g, ''));
    return isNaN(n) ? 0 : n;
  }, [amount]);

  const handleSubmit = useCallback((draft: boolean) => {
    Alert.alert(
      draft ? '✓ Draft Saved' : '✓ Voucher Posted',
      draft ? `${cfg.label} voucher saved as draft.` : `${cfg.label} voucher (${AUTO_NOS[vType]}) posted successfully.`,
      [{ text: 'OK', onPress: () => router.back() }]
    );
  }, [cfg, vType, router]);

  const resetFields = () => {
    setParty(''); setAmount(''); setMode(''); setBank('');
    setRefNo(''); setNarration(''); setDrLedger(''); setCrLedger('');
    setFromLedger(''); setToLedger(''); setContraMode('');
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}
          hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Create Voucher</Text>
        <View style={[s.badge, { backgroundColor: cfg.bg }]}>
          <Text style={[s.badgeTxt, { color: cfg.color }]}>{AUTO_NOS[vType]}</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Type Selector */}
          <View style={s.typeRow}>
            {VTYPES.map(vt => (
              <TouchableOpacity
                key={vt.key}
                style={[s.typeChip, vType === vt.key && { backgroundColor: vt.color, borderColor: vt.color }]}
                onPress={() => { setVType(vt.key); resetFields(); }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={vt.icon as any}
                  size={14}
                  color={vType === vt.key ? '#fff' : COLORS.textSecondary}
                />
                <Text style={[s.typeChipTxt, vType === vt.key && s.typeChipTxtActive]}>
                  {vt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Date + Voucher No */}
          <View style={s.card}>
            <View style={s.row2}>
              <View style={{ flex: 1 }}>
                <Text style={s.fLabel}>Date <Text style={s.star}>*</Text></Text>
                <TextInput
                  style={s.fInput}
                  value={date}
                  onChangeText={setDate}
                  placeholder="DD/MM/YY"
                  placeholderTextColor={COLORS.textTertiary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fLabel}>Voucher No.</Text>
                <View style={s.autoBox}>
                  <Text style={s.autoTxt}>{AUTO_NOS[vType]}</Text>
                  <Ionicons name="lock-closed-outline" size={13} color={COLORS.textTertiary} />
                </View>
              </View>
            </View>
          </View>

          {/* Dynamic Fields */}
          <View style={s.card}>
            <View style={s.cardTitleRow}>
              <View style={[s.cardDot, { backgroundColor: cfg.bg }]}>
                <Ionicons name={cfg.icon as any} size={16} color={cfg.color} />
              </View>
              <Text style={s.cardTitle}>{cfg.label} Details</Text>
            </View>

            {/* PAYMENT / RECEIPT */}
            {(vType === 'payment' || vType === 'receipt') && (
              <>
                <FormDropdown
                  label={vType === 'payment' ? 'Pay To (Party)' : 'Received From (Party)'}
                  value={party} options={PARTIES}
                  onSelect={o => setParty(o.value)}
                  placeholder="Select party..."
                  required
                />
                <FormField
                  label="Amount (₹)" value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric" placeholder="0.00" required
                />
                <FormDropdown
                  label="Mode of Payment"
                  value={mode} options={PMODES}
                  onSelect={o => setMode(o.value)}
                  placeholder="Select mode..." required
                />
                {!isCash && (
                  <FormDropdown
                    label={vType === 'payment' ? 'Pay From (Account)' : 'Receive Into (Account)'}
                    value={bank} options={ACCOUNTS}
                    onSelect={o => setBank(o.value)}
                    placeholder="Select account..." required
                  />
                )}
                {!isCash && (
                  <FormField
                    label="Reference No."
                    value={refNo} onChangeText={setRefNo}
                    placeholder={mode === 'cheque' ? 'Cheque number' : 'Transaction reference'}
                  />
                )}
                <FormField
                  label="Narration"
                  value={narration} onChangeText={setNarration}
                  placeholder="Enter description..."
                  multiline numberOfLines={3}
                  style={{ minHeight: 80, textAlignVertical: 'top' } as any}
                  containerStyle={{ marginBottom: 0 }}
                />
              </>
            )}

            {/* JOURNAL */}
            {vType === 'journal' && (
              <>
                <View style={s.jRow}>
                  <View style={s.jBadge}><Text style={s.jBadgeTxt}>Dr</Text></View>
                  <View style={{ flex: 1 }}>
                    <FormDropdown
                      label="Debit Ledger"
                      value={drLedger} options={LEDGERS}
                      onSelect={o => setDrLedger(o.value)}
                      placeholder="Select ledger..." required
                      containerStyle={{ marginBottom: 0 }}
                    />
                  </View>
                </View>
                <View style={s.jConnector} />
                <View style={s.jRow}>
                  <View style={[s.jBadge, s.jBadgeCr]}><Text style={s.jBadgeTxt}>Cr</Text></View>
                  <View style={{ flex: 1 }}>
                    <FormDropdown
                      label="Credit Ledger"
                      value={crLedger} options={LEDGERS}
                      onSelect={o => setCrLedger(o.value)}
                      placeholder="Select ledger..." required
                      containerStyle={{ marginBottom: 0 }}
                    />
                  </View>
                </View>
                <View style={s.divider} />
                <FormField
                  label="Amount (₹)" value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric" placeholder="0.00" required
                />
                <FormField
                  label="Narration"
                  value={narration} onChangeText={setNarration}
                  placeholder="e.g. Depreciation entry - Jan 2025"
                  multiline numberOfLines={3}
                  style={{ minHeight: 80, textAlignVertical: 'top' } as any}
                  containerStyle={{ marginBottom: 0 }}
                />
              </>
            )}

            {/* CONTRA */}
            {vType === 'contra' && (
              <>
                <FormDropdown
                  label="From Account"
                  value={fromLedger} options={[...ACCOUNTS, ...LEDGERS]}
                  onSelect={o => setFromLedger(o.value)}
                  placeholder="Select account..." required
                />
                <View style={s.contraArrow}>
                  <View style={s.contraLine} />
                  <View style={s.contraCircle}>
                    <Ionicons name="arrow-down" size={16} color={COLORS.textSecondary} />
                  </View>
                  <View style={s.contraLine} />
                </View>
                <FormDropdown
                  label="To Account"
                  value={toLedger} options={[...ACCOUNTS, ...LEDGERS]}
                  onSelect={o => setToLedger(o.value)}
                  placeholder="Select account..." required
                />
                <FormField
                  label="Amount (₹)" value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric" placeholder="0.00" required
                />
                <FormDropdown
                  label="Mode"
                  value={contraMode} options={CONTRA_MODES}
                  onSelect={o => setContraMode(o.value)}
                  placeholder="Select mode..."
                />
                <FormField
                  label="Reference No."
                  value={refNo} onChangeText={setRefNo} placeholder="Optional"
                />
                <FormField
                  label="Narration"
                  value={narration} onChangeText={setNarration}
                  placeholder="e.g. Transfer from ICICI to HDFC"
                  multiline numberOfLines={3}
                  style={{ minHeight: 80, textAlignVertical: 'top' } as any}
                  containerStyle={{ marginBottom: 0 }}
                />
              </>
            )}
          </View>

          {/* Amount Chip */}
          {parsedAmount > 0 && (
            <View style={[s.amtCard, { borderLeftColor: cfg.color }]}>
              <View>
                <Text style={s.amtLabel}>
                  {vType === 'payment' ? 'Paying Out' : vType === 'receipt' ? 'Receiving' : 'Amount'}
                </Text>
                {party && <Text style={s.amtParty}>
                  {PARTIES.find(p => p.value === party)?.label}
                </Text>}
              </View>
              <Text style={[s.amtValue, { color: vType === 'payment' ? COLORS.negative : COLORS.positive }]}>
                ₹{parsedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TouchableOpacity style={s.draftBtn} onPress={() => handleSubmit(true)} activeOpacity={0.7}>
            <Text style={s.draftTxt}>Save Draft</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.submitBtn} onPress={() => handleSubmit(false)} activeOpacity={0.7}>
            <Ionicons name="checkmark-circle" size={18} color={COLORS.white} />
            <Text style={s.submitTxt}>Submit Voucher</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  badgeTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700' },
  scroll: { padding: SPACING.md, paddingBottom: 8 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: SPACING.md },
  typeChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg },
  typeChipTxt: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },
  typeChipTxtActive: { color: '#fff' },
  card: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: SPACING.md },
  cardDot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  row2: { flexDirection: 'row', gap: 12 },
  fLabel: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  fInput: { backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, minHeight: 48 },
  autoBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, minHeight: 48 },
  autoTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '600' },
  star: { color: COLORS.negative },
  jRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: SPACING.sm },
  jBadge: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.negativeBg, alignItems: 'center', justifyContent: 'center', marginTop: 26 },
  jBadgeCr: { backgroundColor: COLORS.positiveBg },
  jBadgeTxt: { fontSize: 11, fontWeight: '800', color: COLORS.textPrimary },
  jConnector: { width: 1, height: 12, backgroundColor: COLORS.borderStrong, marginLeft: 16, marginVertical: 2 },
  divider: { height: 1, backgroundColor: COLORS.borderDefault, marginBottom: SPACING.md },
  contraArrow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  contraLine: { flex: 1, height: 1, backgroundColor: COLORS.borderDefault },
  contraCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault, alignItems: 'center', justifyContent: 'center', marginHorizontal: SPACING.md },
  amtCard: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault, borderLeftWidth: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  amtLabel: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  amtParty: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginTop: 2 },
  amtValue: { fontSize: TYPOGRAPHY.xl, fontWeight: '800' },
  footer: { flexDirection: 'row', gap: 12, paddingHorizontal: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg },
  draftBtn: { flex: 1, paddingVertical: 14, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.borderDefault, alignItems: 'center', justifyContent: 'center' },
  draftTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textSecondary },
  submitBtn: { flex: 2, flexDirection: 'row', gap: 8, paddingVertical: 14, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  submitTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});
