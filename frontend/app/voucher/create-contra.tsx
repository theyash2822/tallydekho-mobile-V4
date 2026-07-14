/**
 * Create Contra Voucher — rewrite (2026-07-14)
 * Source (From / Cr) → Destination (To / Dr). Cash|Bank pickers only.
 * Kind inferred from parents. Cash Count → optional denom sheet (hard match gate).
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import RegularOptionalToggle, { EntryType } from '../../src/components/forms/RegularOptionalToggle';
import DatePickerModal from '../../src/components/forms/DatePickerModal';
import BottomSheetSearch, { BSSOption } from '../../src/components/forms/BottomSheetSearch';
import CashCountSheet, { CashCountResult } from '../../src/components/forms/CashCountSheet';
import { useAuth } from '../../src/context/AuthContext';
import { useSettings } from '../../src/context/SettingsContext';
import {
  createContraVoucher, getBankLedgers, getComplianceConfig,
} from '../../src/services/api';
import { sumDenomCounts } from '../../src/constants/cashDenominations';

const todayStr = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
};
const dmyToISO = (dmy: string): string => {
  if (!dmy) return '';
  const parts = dmy.split('/');
  if (parts.length < 3) return dmy;
  const [dd, mm, yy] = parts;
  const year = parseInt(yy) < 100 ? 2000 + parseInt(yy) : parseInt(yy);
  return `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
};

type LedgerKind = 'cash' | 'bank' | null;
type ContraKind = 'cash_deposit' | 'cash_withdrawal' | 'bank_transfer' | 'cash_transfer' | null;

function inferKind(fromK: LedgerKind, toK: LedgerKind): ContraKind {
  if (fromK === 'cash' && toK === 'bank') return 'cash_deposit';
  if (fromK === 'bank' && toK === 'cash') return 'cash_withdrawal';
  if (fromK === 'bank' && toK === 'bank') return 'bank_transfer';
  if (fromK === 'cash' && toK === 'cash') return 'cash_transfer';
  return null;
}

function txnTypeForKind(kind: ContraKind): string {
  if (kind === 'cash_deposit') return 'Cash';
  if (kind === 'bank_transfer') return 'Inter Bank Transfer';
  if (kind === 'cash_withdrawal') return 'Cheque';
  return 'Cash';
}

export default function CreateContraVoucher() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const { company, isPaired } = useAuth();
  const { currency, formatAmount, currencySymbol } = useSettings();

  const [entryType, setEntryType] = useState<EntryType>('regular');
  const [numberingPolicy, setNumberingPolicy] = useState<'tally_prime_series' | 'tallydekho_series'>('tally_prime_series');

  useEffect(() => {
    if (!company?.guid) return;
    getComplianceConfig(company.guid).then((res: any) => {
      const cfg = res?.data || res;
      setNumberingPolicy(cfg?.numbering_policy === 'tallydekho_series' ? 'tallydekho_series' : 'tally_prime_series');
    }).catch(() => {});
  }, [company?.guid]);

  const [date, setDate] = useState(todayStr());
  const [showDatePicker, setShowDatePicker] = useState(false);
  useEffect(() => {
    if (entryType === 'regular') setDate(todayStr());
  }, [entryType]);

  const [cashLedgers, setCashLedgers] = useState<BSSOption[]>([]);
  const [bankLedgers, setBankLedgers] = useState<BSSOption[]>([]);
  const [fromLedger, setFromLedger] = useState('');
  const [toLedger, setToLedger] = useState('');
  const [fromKind, setFromKind] = useState<LedgerKind>(null);
  const [toKind, setToKind] = useState<LedgerKind>(null);
  const [amount, setAmount] = useState('');
  const [instrumentNo, setInstrumentNo] = useState('');
  const [instrumentDate, setInstrumentDate] = useState('');
  const [showInstDatePicker, setShowInstDatePicker] = useState(false);
  const [narration, setNarration] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    tdkRef: string; isQueued: boolean; voucherNumber?: string; numberingPolicy?: string;
  } | null>(null);

  const [cashCount, setCashCount] = useState<CashCountResult | null>(null);
  const [showCashSheet, setShowCashSheet] = useState(false);

  const loadLedgers = useCallback(async () => {
    if (!company?.guid) return;
    try {
      const [cashRes, bankRes]: any[] = await Promise.all([
        getBankLedgers(company.guid, 'cash'),
        getBankLedgers(company.guid, 'bank'),
      ]);
      const mapList = (rows: any[], kind: 'cash' | 'bank'): BSSOption[] =>
        (rows || []).map((l: any) => ({
          label: l.closing_balance != null
            ? `${l.name} — ${formatAmount(Math.abs(parseFloat(l.closing_balance)))} ${parseFloat(l.closing_balance) < 0 ? 'Cr' : 'Dr'}`
            : l.name,
          value: l.name,
          subtitle: l.parent || kind,
          sub: kind,
          data: l,
        })).sort((a: BSSOption, b: BSSOption) => a.label.localeCompare(b.label));
      setCashLedgers(mapList(cashRes?.data || [], 'cash'));
      setBankLedgers(mapList(bankRes?.data || [], 'bank'));
    } catch {
      setCashLedgers([]);
      setBankLedgers([]);
    }
  }, [company?.guid, formatAmount]);

  useEffect(() => { loadLedgers(); }, [loadLedgers]);

  const allPickers = useMemo(
    () => [...cashLedgers, ...bankLedgers],
    [cashLedgers, bankLedgers],
  );

  const contraKind = useMemo(() => inferKind(fromKind, toKind), [fromKind, toKind]);
  const bankInvolved = fromKind === 'bank' || toKind === 'bank';
  const cashInvolved = fromKind === 'cash' || toKind === 'cash';
  const amtNum = parseFloat(amount) || 0;

  // Amount change after matched count → mismatch (user taps Fix; don't auto-open sheet)
  useEffect(() => {
    if (!cashCount?.used) return;
    const counted = sumDenomCounts(cashCount.denominations);
    const matched = Math.abs(counted - amtNum) < 0.005 && amtNum > 0;
    if (cashCount.matched !== matched || cashCount.target !== amtNum) {
      setCashCount({
        ...cashCount,
        matched,
        counted,
        target: amtNum,
      });
    }
  }, [amount]); // eslint-disable-line react-hooks/exhaustive-deps

  const kindLabel = useMemo(() => {
    switch (contraKind) {
      case 'cash_deposit': return 'Cash → Bank (Deposit)';
      case 'cash_withdrawal': return 'Bank → Cash (Withdrawal)';
      case 'bank_transfer': return 'Bank → Bank (Transfer)';
      case 'cash_transfer': return 'Cash → Cash';
      default: return 'Select source & destination';
    }
  }, [contraKind]);

  const cashCardState: 'none' | 'matched' | 'mismatch' = !cashCount?.used
    ? 'none'
    : cashCount.matched
      ? 'matched'
      : 'mismatch';

  const canSubmit = useMemo(() => {
    if (!fromLedger) return 'Select Source (From) ledger';
    if (!toLedger) return 'Select Destination (To) ledger';
    if (fromLedger === toLedger) return 'Source and Destination must differ';
    if (!(amtNum > 0)) return 'Enter amount';
    if (cashCount?.used && !cashCount.matched) return 'Fix Cash Count to match amount (or clear it)';
    return null;
  }, [fromLedger, toLedger, amtNum, cashCount]);

  const selectFrom = (opt: BSSOption) => {
    setFromLedger(opt.value);
    setFromKind((opt.sub as LedgerKind) || (cashLedgers.some(c => c.value === opt.value) ? 'cash' : 'bank'));
  };
  const selectTo = (opt: BSSOption) => {
    setToLedger(opt.value);
    setToKind((opt.sub as LedgerKind) || (cashLedgers.some(c => c.value === opt.value) ? 'cash' : 'bank'));
  };

  const swapLedgers = () => {
    if (!fromLedger && !toLedger) return;
    setFromLedger(toLedger);
    setToLedger(fromLedger);
    setFromKind(toKind);
    setToKind(fromKind);
  };

  const handleSubmit = async () => {
    if (canSubmit) { Alert.alert('Required', canSubmit); return; }
    if (!isPaired) {
      Toast.show({ type: 'error', text1: 'Not Paired', text2: 'Pair with Tally Desktop first.' });
      return;
    }
    setSubmitting(true);
    try {
      const kind = contraKind;
      const payload: any = {
        companyGuid: company?.guid,
        companyName: company?.name,
        date: dmyToISO(date),
        amount: amtNum,
        fromLedger,
        toLedger,
        fromIsCash: fromKind === 'cash',
        toIsCash: toKind === 'cash',
        fromIsBank: fromKind === 'bank',
        toIsBank: toKind === 'bank',
        contraKind: kind,
        entryType,
        numbering_policy: numberingPolicy,
        narration: narration || undefined,
      };
      if (bankInvolved || instrumentNo || instrumentDate) {
        payload.instrumentDetails = {
          instrumentNo: instrumentNo || undefined,
          instrumentDate: instrumentDate ? dmyToISO(instrumentDate) : dmyToISO(date),
          transactionType: txnTypeForKind(kind),
        };
        if (instrumentNo) payload.reference = instrumentNo;
      }
      if (cashCount?.used && cashCount.matched) {
        payload.cashCount = {
          used: true,
          matched: true,
          denominations: cashCount.denominations,
          counted: cashCount.counted,
          target: amtNum,
        };
      }
      const res: any = await createContraVoucher(payload);
      const tdkRef = res?.tdkRef || res?.tdkReferenceNo || '';
      setSubmitResult({
        tdkRef,
        isQueued: res?.queued === true,
        voucherNumber: res?.voucherNumber || undefined,
        numberingPolicy: res?.numberingPolicy || numberingPolicy,
      });
      setShowSuccess(true);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Submit Failed', text2: e?.message || 'Check Tally connection.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.hdr}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.hdrTitle}>Contra Voucher</Text>
        <RegularOptionalToggle value={entryType} onChange={setEntryType} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'android' ? 80 : 0}
      >
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={Keyboard.dismiss}
        >
          <View style={s.section}>
            <View style={[s.fieldBlock, { padding: SPACING.md }]}>
              <View style={s.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={s.fLabel}>Contra No.</Text>
                  <View style={s.autoBox}>
                    <Text style={s.autoTxt}>Auto</Text>
                    <Ionicons name="lock-closed-outline" size={13} color={COLORS.textTertiary} />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.fLabel}>Date <Text style={s.req}>*</Text></Text>
                  {entryType === 'regular' ? (
                    <View style={[s.autoBox, { opacity: 0.55 }]}>
                      <Text style={s.autoTxt}>{date}</Text>
                      <Ionicons name="lock-closed-outline" size={13} color={COLORS.textTertiary} />
                    </View>
                  ) : (
                    <TouchableOpacity style={s.fInput} onPress={() => setShowDatePicker(true)} activeOpacity={0.8}>
                      <Text style={{ color: date ? COLORS.textPrimary : COLORS.textTertiary, fontSize: TYPOGRAPHY.sm, fontWeight: '600' }}>
                        {date || 'Select date'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          </View>

          <View style={s.section}>
            <Text style={s.sectionTitle}>Transfer</Text>
            <Text style={s.kindHint}>{kindLabel}</Text>
            <View style={s.fieldBlock}>
              <View style={{ padding: SPACING.md, gap: 12 }}>
                <BottomSheetSearch
                  label="Source (From / Credit)"
                  required
                  placeholder="Cash or Bank ledger"
                  value={fromLedger}
                  options={allPickers}
                  onSelect={selectFrom}
                  onClear={() => { setFromLedger(''); setFromKind(null); }}
                  sheetTitle="Select Source"
                  searchPlaceholder="Search cash / bank..."
                  icon="arrow-up-circle-outline"
                />
                <TouchableOpacity style={s.swapBtn} onPress={swapLedgers} activeOpacity={0.8}>
                  <Ionicons name="swap-vertical" size={18} color={COLORS.brandPrimary} />
                  <Text style={s.swapTxt}>Swap</Text>
                </TouchableOpacity>
                <BottomSheetSearch
                  label="Destination (To / Debit)"
                  required
                  placeholder="Cash or Bank ledger"
                  value={toLedger}
                  options={allPickers}
                  onSelect={selectTo}
                  onClear={() => { setToLedger(''); setToKind(null); }}
                  sheetTitle="Select Destination"
                  searchPlaceholder="Search cash / bank..."
                  icon="arrow-down-circle-outline"
                />
              </View>
            </View>
          </View>

          <View style={s.section}>
            <Text style={s.sectionTitle}>Amount</Text>
            <View style={s.fieldBlock}>
              <View style={{ padding: SPACING.md }}>
                <View style={s.inputWrap}>
                  <Text style={s.rupee}>{currencySymbol}</Text>
                  <TextInput
                    style={s.input}
                    placeholder="Enter amount"
                    placeholderTextColor={COLORS.textTertiary}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </View>
          </View>

          {bankInvolved && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Instrument</Text>
              <View style={[s.fieldBlock, { padding: SPACING.md, gap: 12 }]}>
                <View>
                  <Text style={s.fLabel}>Instrument No.</Text>
                  <TextInput
                    style={s.fInput}
                    placeholder="Cheque / ref no. (optional)"
                    placeholderTextColor={COLORS.textTertiary}
                    value={instrumentNo}
                    onChangeText={setInstrumentNo}
                  />
                </View>
                <View>
                  <Text style={s.fLabel}>Instrument Date</Text>
                  <TouchableOpacity style={s.fInput} onPress={() => setShowInstDatePicker(true)} activeOpacity={0.8}>
                    <Text style={{ color: instrumentDate ? COLORS.textPrimary : COLORS.textTertiary, fontSize: TYPOGRAPHY.sm, fontWeight: '600' }}>
                      {instrumentDate || date || 'Select date'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={s.hint}>Tally method defaults by transfer type ({txnTypeForKind(contraKind)}).</Text>
              </View>
            </View>
          )}

          {cashInvolved && amtNum > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Cash Count</Text>
              <TouchableOpacity
                style={[
                  s.cashCard,
                  cashCardState === 'matched' && s.cashMatched,
                  cashCardState === 'mismatch' && s.cashMismatch,
                ]}
                onPress={() => setShowCashSheet(true)}
                activeOpacity={0.85}
              >
                <View style={s.cashLeft}>
                  <View style={[
                    s.cashIcon,
                    { backgroundColor:
                      cashCardState === 'matched' ? COLORS.positiveBg
                        : cashCardState === 'mismatch' ? '#FEE2E2'
                          : COLORS.pageBg },
                  ]}>
                    <Ionicons
                      name={
                        cashCardState === 'matched' ? 'checkmark-circle'
                          : cashCardState === 'mismatch' ? 'alert-circle'
                            : 'cash-outline'
                      }
                      size={20}
                      color={
                        cashCardState === 'matched' ? COLORS.positive
                          : cashCardState === 'mismatch' ? COLORS.negative
                            : COLORS.textSecondary
                      }
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cashTitle}>
                      {cashCardState === 'none' && 'Not added'}
                      {cashCardState === 'matched' && 'Matched'}
                      {cashCardState === 'mismatch' && 'Mismatch'}
                    </Text>
                    <Text style={s.cashSub}>
                      {cashCardState === 'none' && 'Optional — tap to add denomination'}
                      {cashCardState === 'matched' && `${formatAmount(cashCount!.counted)} counted`}
                      {cashCardState === 'mismatch' && `Counted ≠ ${formatAmount(amtNum)} — tap Fix`}
                    </Text>
                  </View>
                </View>
                <Text style={s.cashAction}>
                  {cashCardState === 'mismatch' ? 'Fix' : cashCardState === 'matched' ? 'Edit' : 'Add'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={s.section}>
            <Text style={s.sectionTitle}>Narration</Text>
            <View style={s.fieldBlock}>
              <TextInput
                style={s.textarea}
                placeholder="Optional notes"
                placeholderTextColor={COLORS.textTertiary}
                value={narration}
                onChangeText={setNarration}
                multiline
                textAlignVertical="top"
              />
            </View>
          </View>

          <TouchableOpacity
            style={[s.btnPrimary, (!!canSubmit || submitting) && { opacity: 0.55 }]}
            onPress={handleSubmit}
            disabled={!!canSubmit || submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={s.btnPrimaryTxt}>
                  {entryType === 'optional' ? 'Save Optional Contra' : 'Submit Contra'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <DatePickerModal
        visible={showDatePicker}
        value={date}
        onSelect={(d) => { setDate(d); setShowDatePicker(false); }}
        onClose={() => setShowDatePicker(false)}
      />
      <DatePickerModal
        visible={showInstDatePicker}
        value={instrumentDate || date}
        onSelect={(d) => { setInstrumentDate(d); setShowInstDatePicker(false); }}
        onClose={() => setShowInstDatePicker(false)}
      />

      <CashCountSheet
        visible={showCashSheet}
        onClose={() => setShowCashSheet(false)}
        targetAmount={amtNum}
        currency={currency}
        initialCounts={cashCount?.used ? cashCount.denominations : null}
        onApply={(r) => setCashCount(r)}
        onClear={() => setCashCount(null)}
      />

      {showSuccess && submitResult && (
        <View style={s.successOverlay}>
          <View style={s.successCard}>
            <Ionicons name="checkmark-circle" size={48} color={COLORS.positive} />
            <Text style={s.successTitle}>Contra Saved</Text>
            <Text style={s.successSub}>
              {submitResult.isQueued ? 'Queued for Tally sync' : 'Posted to Tally'}
            </Text>
            {!!submitResult.tdkRef && (
              <Text style={s.successRef}>{submitResult.tdkRef}</Text>
            )}
            {!!submitResult.voucherNumber && (
              <Text style={s.successVno}>#{submitResult.voucherNumber}</Text>
            )}
            <TouchableOpacity
              style={s.btnPrimary}
              onPress={() => {
                setShowSuccess(false);
                if (submitResult.tdkRef) {
                  router.replace(`/voucher/contra-preview?tdkRef=${encodeURIComponent(submitResult.tdkRef)}` as any);
                } else {
                  router.back();
                }
              }}
              activeOpacity={0.85}
            >
              <Text style={s.btnPrimaryTxt}>View Preview</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.btnGhost}
              onPress={() => { setShowSuccess(false); router.back(); }}
              activeOpacity={0.8}
            >
              <Text style={s.btnGhostTxt}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  hdr: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.cardBg,
    paddingHorizontal: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  back: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center' },
  hdrTitle: { flex: 1, fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  scroll: { padding: SPACING.md, gap: 14, paddingBottom: 24 },
  section: { gap: 8 },
  fieldBlock: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1,
    borderColor: COLORS.borderDefault, overflow: 'hidden',
  },
  row2: { flexDirection: 'row', gap: 12 },
  fLabel: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  fInput: {
    backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault,
    borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, minHeight: 48, justifyContent: 'center',
    fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, fontWeight: '600',
  },
  autoBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault,
    borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, minHeight: 48,
  },
  autoTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '600' },
  sectionTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  kindHint: { fontSize: 12, color: COLORS.textTertiary, marginTop: -4 },
  req: { color: COLORS.negative },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: COLORS.borderDefault,
    borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: COLORS.pageBg,
  },
  input: { flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  rupee: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textSecondary },
  hint: { fontSize: 12, color: COLORS.textTertiary, lineHeight: 16 },
  swapBtn: {
    alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.borderDefault, backgroundColor: COLORS.pageBg,
  },
  swapTxt: { fontSize: 12, fontWeight: '600', color: COLORS.brandPrimary },
  cashCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1,
    borderColor: COLORS.borderDefault, padding: SPACING.md, gap: 10,
  },
  cashMatched: { borderColor: COLORS.positive },
  cashMismatch: { borderColor: COLORS.negative },
  cashLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  cashIcon: {
    width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  cashTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  cashSub: { fontSize: 12, color: COLORS.textTertiary, marginTop: 2 },
  cashAction: { fontSize: 13, fontWeight: '700', color: COLORS.brandPrimary },
  textarea: {
    borderWidth: 0, padding: 14, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary,
    backgroundColor: COLORS.cardBg, minHeight: 88,
  },
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.lg, paddingVertical: 16,
  },
  btnPrimaryTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: '#fff' },
  btnGhost: { alignItems: 'center', paddingVertical: 12 },
  btnGhostTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  successOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 50,
  },
  successCard: {
    width: '100%', backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: 24,
    alignItems: 'center', gap: 10,
  },
  successTitle: { fontSize: TYPOGRAPHY.lg, fontWeight: '800', color: COLORS.textPrimary },
  successSub: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  successRef: { fontSize: 12, fontWeight: '600', color: COLORS.brandPrimary, marginTop: 4 },
  successVno: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
});
