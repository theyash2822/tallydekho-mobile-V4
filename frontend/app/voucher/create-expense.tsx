/**
 * Create Expense Voucher — mirrors Web Portal 4.0 ExpenseForm.
 * Recorded as a payment voucher: debit expense ledger, credit cash/bank.
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
import RegularOptionalToggle from '../../src/components/forms/RegularOptionalToggle';
import DatePickerModal from '../../src/components/forms/DatePickerModal';
import BottomSheetSearch, { BSSOption } from '../../src/components/forms/BottomSheetSearch';
import { useAuth } from '../../src/context/AuthContext';
import { useSettings } from '../../src/context/SettingsContext';
import {
  createPaymentVoucher, getLedgers, getBankLedgers, getParties,
} from '../../src/services/api';
import { useNumberingPolicy } from '../../src/hooks/useNumberingPolicy';
import { useRbasCreate } from '../../src/hooks/useRbasCreate';
import { shareVoucherPdfByRef } from '../../src/utils/voucherPdf';
import { useTranslation } from 'react-i18next';
import { useRequireCapability } from '../../src/components/RequireCapability';

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

function parentContainsExpense(row: any): boolean {
  const parent = String(row?.parent || row?.parent_name || row?.group || '').toLowerCase();
  return parent.includes('expense');
}

function parentContainsCash(row: any): boolean {
  const parent = String(row?.parent || row?.parent_name || row?.group || '').toLowerCase();
  const name = String(row?.name || '').toLowerCase();
  return parent.includes('cash') || name.includes('cash');
}

export default function CreateExpenseVoucher() {
  const allowed = useRequireCapability('expense.create');
  const { t } = useTranslation();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const narrationY = useRef(0);
  const { company } = useAuth();
  const { currencySymbol } = useSettings();
  const { numberingPolicy } = useNumberingPolicy(company?.guid);

  const {entryMode, entryType, setEntryType, scopeParties, assertCanCreate} = useRbasCreate();
  const [date, setDate] = useState(todayStr());
  const [showDatePicker, setShowDatePicker] = useState(false);
  useEffect(() => {
    if (entryType === 'regular') setDate(todayStr());
  }, [entryType]);

  const [expenseLedgers, setExpenseLedgers] = useState<BSSOption[]>([]);
  const [paidFromOptions, setPaidFromOptions] = useState<BSSOption[]>([]);
  const [expenseLedger, setExpenseLedger] = useState('');
  const [expenseData, setExpenseData] = useState<any>(null);
  const [paidFrom, setPaidFrom] = useState('');
  const [paidFromData, setPaidFromData] = useState<any>(null);
  const [amount, setAmount] = useState('');
  const [narration, setNarration] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    tdkRef: string; isQueued: boolean; voucherNumber?: string; numberingPolicy?: string;
  } | null>(null);
  const [sharePdfLoading, setSharePdfLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!company?.guid) return;
    setLoading(true);
    try {
      const [ledgersRes, partiesRes, banksRes]: any[] = await Promise.all([
        getLedgers(company.guid, { limit: 500 }),
        getParties(company.guid, { type: 'expense' }),
        getBankLedgers(company.guid, 'all'),
      ]);
      const byName = new Map<string, BSSOption>();
      const addRow = (l: any) => {
        if (!l?.name) return;
        byName.set(l.name, {
          label: l.name,
          value: l.name,
          subtitle: l.parent || undefined,
          data: l,
        });
      };
      const ledgerRows = scopeParties(ledgersRes?.data || ledgersRes?.ledgers || []);
      (Array.isArray(ledgerRows) ? ledgerRows : []).filter(parentContainsExpense).forEach(addRow);
      scopeParties(partiesRes?.data || []).forEach(addRow);
      setExpenseLedgers(
        Array.from(byName.values()).sort((a, b) => a.label.localeCompare(b.label)),
      );

      const bankRows = scopeParties(banksRes?.data || []);
      setPaidFromOptions(
        (bankRows || []).map((l: any) => ({
          label: l.name,
          value: l.name,
          subtitle: l.parent || undefined,
          data: l,
        })).sort((a: BSSOption, b: BSSOption) => a.label.localeCompare(b.label)),
      );
    } catch {
      setExpenseLedgers([]);
      setPaidFromOptions([]);
    } finally {
      setLoading(false);
    }
  }, [company?.guid, scopeParties]);

  useEffect(() => { loadData(); }, [loadData]);

  const amtNum = parseFloat(amount) || 0;

  const canSubmit = useMemo(() => {
    if (!expenseLedger) return t('voucher.selectExpenseLedger');
    if (!paidFrom) return t('voucher.selectPaidFrom');
    if (!(amtNum > 0)) return t('voucher.enterAmount');
    if (!date) return t('voucher.requiredFields');
    return null;
  }, [expenseLedger, paidFrom, amtNum, date, t]);

  const handleSubmit = async () => {
    if (canSubmit) { Alert.alert(t('voucher.required'), canSubmit); return; }
    if (!assertCanCreate('expense.create')) return;
    setSubmitting(true);
    try {
      const paymentMethod = parentContainsCash(paidFromData) ? 'Cash' : 'Bank';
      const payload = {
        companyGuid: company?.guid,
        companyName: company?.name,
        date: dmyToISO(date),
        amount: amtNum,
        partyLedger: expenseLedger,
        ledgerAccount: paidFrom,
        paymentMethod,
        billAllocations: [],
        entryType,
        numbering_policy: numberingPolicy,
        narration: narration.trim() || undefined,
      };
      const res: any = await createPaymentVoucher(payload);
      const tdkRef = res?.tdkRef || res?.tdkReferenceNo || res?.data?.tdkRef || '';
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

  if (!allowed) return null;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.hdr}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.hdrTitle}>{t('voucher.expenseTitle')}</Text>
        <RegularOptionalToggle value={entryType} onChange={setEntryType} entryMode={entryMode} />
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
          <View style={s.note}>
            <Ionicons name="information-circle-outline" size={16} color={COLORS.textSecondary} />
            <Text style={s.noteTxt}>{t('voucher.expenseAsPaymentNote')}</Text>
          </View>

          <View style={s.section}>
            <View style={[s.fieldBlock, { padding: SPACING.md }]}>
              <View style={s.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={s.fLabel}>{t('voucher.expenseNo')}</Text>
                  <View style={s.autoBox}>
                    <Text style={s.autoTxt}>Auto</Text>
                    <Ionicons name="lock-closed-outline" size={13} color={COLORS.textTertiary} />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.fLabel}>{t('voucher.date')} <Text style={s.req}>*</Text></Text>
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
            <Text style={s.sectionTitle}>{t('voucher.expenseDetails')}</Text>
            <View style={s.fieldBlock}>
              {loading ? (
                <View style={s.loadingBox}>
                  <ActivityIndicator size="small" color={COLORS.brandPrimary} />
                </View>
              ) : (
                <>
                  <View style={s.field}>
                    <BottomSheetSearch
                      label={t('voucher.expenseLedger')}
                      required
                      placeholder={t('voucher.selectExpenseLedger')}
                      value={expenseLedger}
                      options={expenseLedgers}
                      onSelect={(opt) => { setExpenseLedger(opt.value); setExpenseData(opt.data || null); }}
                      onClear={() => { setExpenseLedger(''); setExpenseData(null); }}
                      sheetTitle={t('voucher.expenseLedger')}
                      searchPlaceholder="Search expense ledgers…"
                      icon="wallet-outline"
                    />
                    {!!expenseData?.parent && (
                      <View style={s.chipRow}>
                        <View style={s.chip}><Text style={s.chipTxt}>{expenseData.parent}</Text></View>
                      </View>
                    )}
                    {!loading && expenseLedgers.length === 0 && (
                      <Text style={s.hintTxt}>{t('voucher.noExpenseLedgers')}</Text>
                    )}
                  </View>
                  <View style={s.div} />
                  <View style={s.field}>
                    <BottomSheetSearch
                      label={t('voucher.paidFrom')}
                      required
                      placeholder={t('voucher.selectPaidFrom')}
                      value={paidFrom}
                      options={paidFromOptions}
                      onSelect={(opt) => { setPaidFrom(opt.value); setPaidFromData(opt.data || null); }}
                      onClear={() => { setPaidFrom(''); setPaidFromData(null); }}
                      sheetTitle={t('voucher.paidFrom')}
                      searchPlaceholder="Search cash / bank…"
                      icon="card-outline"
                    />
                  </View>
                  <View style={s.div} />
                  <View style={s.field}>
                    <Text style={s.label}>{t('voucher.amount')} <Text style={s.req}>*</Text></Text>
                    <View style={s.inputWrap}>
                      <Text style={s.rupee}>{currencySymbol || '₹'}</Text>
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
                </>
              )}
            </View>
          </View>

          <View
            style={s.section}
            onLayout={(e) => { narrationY.current = e.nativeEvent.layout.y; }}
          >
            <Text style={s.sectionTitle}>{t('voucher.narration')}</Text>
            <View style={s.fieldBlock}>
              <View style={s.field}>
                <TextInput
                  style={s.textarea}
                  placeholder="Notes (optional)"
                  placeholderTextColor={COLORS.textTertiary}
                  value={narration}
                  onChangeText={setNarration}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  onFocus={() => {
                    setTimeout(() => {
                      scrollRef.current?.scrollTo?.({ y: Math.max(0, narrationY.current - 100), animated: true });
                    }, 250);
                  }}
                />
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[s.btnPrimary, (!!canSubmit || submitting || loading) && { opacity: 0.6 }]}
            onPress={handleSubmit}
            activeOpacity={0.8}
            disabled={!!canSubmit || submitting || loading}
          >
            {submitting
              ? <ActivityIndicator size="small" color={COLORS.white} />
              : <Ionicons name="send" size={16} color={COLORS.white} />}
            <Text style={s.btnPriTxt}>
              {submitting ? t('voucher.submitting') : t('voucher.submitExpense')}
            </Text>
          </TouchableOpacity>
          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <DatePickerModal
        visible={showDatePicker}
        value={date}
        onSelect={(d) => { setDate(d); setShowDatePicker(false); }}
        onClose={() => setShowDatePicker(false)}
      />

      {showSuccess && submitResult && (
        <View style={s.successOverlay}>
          <View style={s.successCard}>
            <Ionicons
              name={submitResult.isQueued ? 'time-outline' : 'checkmark-circle'}
              size={48}
              color={submitResult.isQueued ? COLORS.warning : COLORS.positive}
            />
            <Text style={s.successTitle}>
              {submitResult.isQueued ? t('voucher.expenseQueued') : t('voucher.expenseSaved')}
            </Text>
            <Text style={s.successSub}>
              {submitResult.isQueued
                ? 'Entry queued. Will push to Tally when desktop reconnects.'
                : 'Expense recorded as payment voucher.'}
            </Text>
            {!!submitResult.tdkRef && <Text style={s.successRef}>{submitResult.tdkRef}</Text>}
            <TouchableOpacity
              style={[s.btnPrimary, { width: '100%' }]}
              onPress={() => {
                setShowSuccess(false);
                if (submitResult.tdkRef) {
                  router.replace(`/voucher/expense-preview?tdkRef=${encodeURIComponent(submitResult.tdkRef)}` as any);
                } else {
                  router.back();
                }
              }}
              activeOpacity={0.85}
            >
              <Text style={s.btnPriTxt}>View Preview</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.pdfBtn, sharePdfLoading && { opacity: 0.7 }]}
              activeOpacity={0.85}
              disabled={sharePdfLoading}
              onPress={async () => {
                if (!submitResult.tdkRef || !company?.guid) return;
                setSharePdfLoading(true);
                try {
                  await shareVoucherPdfByRef(submitResult.tdkRef, company.guid, {
                    documentType: 'expense_voucher',
                    onBeforeShare: () => setSharePdfLoading(false),
                    fallback: async () => {
                      Toast.show({ type: 'info', text1: 'Sharing not available on this device' });
                    },
                  });
                } catch (err: any) {
                  Toast.show({ type: 'error', text1: 'PDF Error', text2: err?.message || 'Could not generate PDF' });
                } finally {
                  setSharePdfLoading(false);
                }
              }}
            >
              {sharePdfLoading
                ? <ActivityIndicator size="small" color={COLORS.white} />
                : <Ionicons name="document-outline" size={18} color={COLORS.white} />}
              <Text style={s.pdfBtnTxt}>{sharePdfLoading ? 'PDF is creating...' : 'Share PDF'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setShowSuccess(false); router.back(); }} style={{ paddingVertical: 10 }}>
              <Text style={{ color: COLORS.textSecondary, fontWeight: '600' }}>Done</Text>
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
  note: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: COLORS.warningBg || '#FEF3C7', borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  noteTxt: { flex: 1, fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, lineHeight: 16 },
  row2: { flexDirection: 'row', gap: 12 },
  fLabel: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  fInput: {
    backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault,
    borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, minHeight: 48, justifyContent: 'center',
  },
  autoBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault,
    borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, minHeight: 48,
  },
  autoTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '600' },
  section: { gap: 8 },
  sectionTitle: {
    fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginLeft: 2,
  },
  fieldBlock: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1,
    borderColor: COLORS.borderDefault, overflow: 'hidden',
  },
  field: { paddingHorizontal: SPACING.md, paddingVertical: 12 },
  div: { height: 1, backgroundColor: COLORS.borderDefault, marginLeft: SPACING.md },
  label: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  req: { color: COLORS.negative },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault,
    borderRadius: RADIUS.md, paddingHorizontal: 14, minHeight: 48,
  },
  rupee: { fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textSecondary },
  input: { flex: 1, fontSize: TYPOGRAPHY.md, fontWeight: '600', color: COLORS.textPrimary, paddingVertical: 12 },
  textarea: {
    backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault,
    borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12,
    minHeight: 80, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: {
    backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault,
    borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 4,
  },
  chipTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '600' },
  hintTxt: { marginTop: 8, fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, lineHeight: 16 },
  loadingBox: { padding: 24, alignItems: 'center' },
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.lg, paddingVertical: 14, marginTop: 4,
  },
  btnPriTxt: { color: COLORS.white, fontSize: TYPOGRAPHY.md, fontWeight: '700' },
  pdfBtn: { flexDirection: 'row', gap: 8, backgroundColor: COLORS.brandPrimary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 20, width: '100%', justifyContent: 'center', alignItems: 'center' },
  pdfBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
  successOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 50,
  },
  successCard: {
    width: '100%', backgroundColor: COLORS.cardBg, borderRadius: RADIUS.xl,
    padding: 24, alignItems: 'center', gap: 10,
  },
  successTitle: { fontSize: TYPOGRAPHY.lg, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center' },
  successSub: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  successRef: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.brandPrimary, marginTop: 4 },
});
