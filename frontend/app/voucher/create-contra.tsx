/**
 * Create Contra Voucher — restore original From/To transfer UI (2026-07-14)
 * Keeps working Cash|Bank pickers, API payload, Cash Count sheet (no ₹2000 note).
 * Cash Count card shows whenever amount > 0.
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Keyboard, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import RegularOptionalToggle from '../../src/components/forms/RegularOptionalToggle';
import DatePickerModal from '../../src/components/forms/DatePickerModal';
import BottomSheetSearch, { BSSOption } from '../../src/components/forms/BottomSheetSearch';
import CashCountSheet, { CashCountResult } from '../../src/components/forms/CashCountSheet';
import { useAuth } from '../../src/context/AuthContext';
import { useSettings } from '../../src/context/SettingsContext';
import {
  createContraVoucher, getBankLedgers,
} from '../../src/services/api';
import { sumDenomCounts } from '../../src/constants/cashDenominations';
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
  const allowed = useRequireCapability('contra.create');
  const { t } = useTranslation();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const { company } = useAuth();
  const { settings, formatAmount, currencySymbol } = useSettings();

  const {entryMode, entryType, setEntryType, scopeParties, assertCanCreate} = useRbasCreate();
  const { numberingPolicy } = useNumberingPolicy(company?.guid);
  const narrationY = useRef(0);

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
  const [narration, setNarration] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    tdkRef: string; isQueued: boolean; voucherNumber?: string;
  } | null>(null);
  const [sharePdfLoading, setSharePdfLoading] = useState(false);

  const [cashCount, setCashCount] = useState<CashCountResult | null>(null);
  const [showCashSheet, setShowCashSheet] = useState(false);

  const classifyKind = useCallback((opt: BSSOption, cashList: BSSOption[]): LedgerKind => {
    if (opt.sub === 'cash' || opt.sub === 'bank') return opt.sub;
    if (cashList.some(c => c.value === opt.value)) return 'cash';
    const parent = String(opt.subtitle || opt.data?.parent || '').toLowerCase();
    const name = String(opt.value || '').toLowerCase();
    if (parent.includes('cash') || name.includes('cash')) return 'cash';
    return 'bank';
  }, []);

  const loadLedgers = useCallback(async () => {
    if (!company?.guid) return;
    try {
      const [cashRes, bankRes]: any[] = await Promise.all([
        getBankLedgers(company.guid, 'cash'),
        getBankLedgers(company.guid, 'bank'),
      ]);
      const mapList = (rows: any[], kind: 'cash' | 'bank'): BSSOption[] =>
        (rows || []).map((l: any) => ({
          label: l.name,
          value: l.name,
          subtitle: l.parent || kind,
          sub: kind,
          data: l,
        })).sort((a: BSSOption, b: BSSOption) => a.label.localeCompare(b.label));
      setCashLedgers(mapList(scopeParties(cashRes?.data || []), 'cash'));
      setBankLedgers(mapList(scopeParties(bankRes?.data || []), 'bank'));
    } catch {
      setCashLedgers([]);
      setBankLedgers([]);
    }
  }, [company?.guid, scopeParties]);

  useEffect(() => { loadLedgers(); }, [loadLedgers]);

  const allPickers = useMemo(
    () => [...cashLedgers, ...bankLedgers],
    [cashLedgers, bankLedgers],
  );

  const contraKind = useMemo(() => inferKind(fromKind, toKind), [fromKind, toKind]);
  const bankInvolved = fromKind === 'bank' || toKind === 'bank';
  const amtNum = parseFloat(amount) || 0;

  useEffect(() => {
    if (!cashCount?.used) return;
    const counted = sumDenomCounts(cashCount.denominations);
    const matched = Math.abs(counted - amtNum) < 0.005 && amtNum > 0;
    if (cashCount.matched !== matched || cashCount.target !== amtNum) {
      setCashCount({ ...cashCount, matched, counted, target: amtNum });
    }
  }, [amount]); // eslint-disable-line react-hooks/exhaustive-deps

  const cashCardState: 'none' | 'matched' | 'mismatch' = !cashCount?.used
    ? 'none'
    : cashCount.matched
      ? 'matched'
      : 'mismatch';

  const canSubmit = useMemo(() => {
    if (!fromLedger) return 'Select From Ledger';
    if (!toLedger) return 'Select To Ledger';
    if (fromLedger === toLedger) return 'From and To must differ';
    if (!(amtNum > 0)) return 'Enter amount';
    if (cashCount?.used && !cashCount.matched) return 'Fix Cash Count to match amount (or clear it)';
    return null;
  }, [fromLedger, toLedger, amtNum, cashCount]);

  const selectFrom = (opt: BSSOption) => {
    setFromLedger(opt.value);
    setFromKind(classifyKind(opt, cashLedgers));
  };
  const selectTo = (opt: BSSOption) => {
    setToLedger(opt.value);
    setToKind(classifyKind(opt, cashLedgers));
  };

  const handleSubmit = async () => {
    if (canSubmit) { Alert.alert(t('voucher.required'), canSubmit); return; }
    if (!assertCanCreate('contra.create')) return;
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
        fromIsBank: fromKind === 'bank' || fromKind == null,
        toIsBank: toKind === 'bank' || toKind == null,
        contraKind: kind,
        entryType,
        numbering_policy: numberingPolicy,
        narration: narration || undefined,
      };
      if (bankInvolved || instrumentNo) {
        payload.instrumentDetails = {
          instrumentNo: instrumentNo || undefined,
          instrumentDate: dmyToISO(date),
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
        <Text style={s.hdrTitle}>{t('voucher.contraTitle')}</Text>
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
          {/* ── Contra No. + Date (mirrors Journal / Receipt / Payment) ───── */}
          <View style={s.section}>
            <View style={[s.fieldBlock, { padding: SPACING.md }]}>
              <View style={s.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={s.fLabel}>{t('voucher.contraNo')}</Text>
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

          {/* Transfer visual — original From / To cards */}
          <View style={s.transferRow}>
            <View style={s.transferBox}>
              <Ionicons name="arrow-up-circle" size={24} color={COLORS.negative} />
              <Text style={s.transferLabel}>From</Text>
              <Text style={s.transferName} numberOfLines={2}>{fromLedger || 'Source Account'}</Text>
            </View>
            <View style={s.transferMid}>
              <View style={s.transferArrow}>
                <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
              </View>
              {amount ? <Text style={s.transferAmt}>{currencySymbol}{amount}</Text> : null}
            </View>
            <View style={s.transferBox}>
              <Ionicons name="arrow-down-circle" size={24} color={COLORS.positive} />
              <Text style={s.transferLabel}>To</Text>
              <Text style={s.transferName} numberOfLines={2}>{toLedger || 'Destination Account'}</Text>
            </View>
          </View>

          {/* Transfer Accounts — original section look, ledger pickers */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Transfer Accounts</Text>
            <View style={s.fieldBlock}>
              <View style={s.field}>
                <BottomSheetSearch
                  label="From Ledger"
                  required
                  placeholder="e.g. Cash in Hand"
                  value={fromLedger}
                  options={allPickers}
                  onSelect={selectFrom}
                  onClear={() => { setFromLedger(''); setFromKind(null); }}
                  sheetTitle="Select From Ledger"
                  searchPlaceholder="Search cash / bank..."
                  icon="log-out-outline"
                />
              </View>
              <View style={s.div} />
              <View style={s.field}>
                <BottomSheetSearch
                  label="To Ledger"
                  required
                  placeholder="e.g. HDFC Bank Account"
                  value={toLedger}
                  options={allPickers}
                  onSelect={selectTo}
                  onClear={() => { setToLedger(''); setToKind(null); }}
                  sheetTitle="Select To Ledger"
                  searchPlaceholder="Search cash / bank..."
                  icon="log-in-outline"
                />
              </View>
            </View>
          </View>

          {/* Amount + optional instrument */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Transaction Details</Text>
            <View style={s.fieldBlock}>
              <View style={s.field}>
                <Text style={s.label}>Amount <Text style={s.req}>*</Text></Text>
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
              {bankInvolved && (
                <>
                  <View style={s.div} />
                  <View style={s.field}>
                    <Text style={s.label}>Reference No.</Text>
                    <View style={s.inputWrap}>
                      <Ionicons name="keypad-outline" size={16} color={COLORS.textTertiary} />
                      <TextInput
                        style={s.input}
                        placeholder="Cheque / reference (optional)"
                        placeholderTextColor={COLORS.textTertiary}
                        value={instrumentNo}
                        onChangeText={setInstrumentNo}
                      />
                    </View>
                  </View>
                </>
              )}
            </View>
          </View>

          {/* Cash Count — always after amount (>0). Was hidden earlier when cash kind not detected. */}
          {amtNum > 0 && (
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
                    {
                      backgroundColor:
                        cashCardState === 'matched' ? COLORS.positiveBg
                          : cashCardState === 'mismatch' ? COLORS.negativeBg
                            : COLORS.pageBg,
                    },
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

          <View
            style={s.section}
            onLayout={(e) => { narrationY.current = e.nativeEvent.layout.y; }}
          >
            <Text style={s.sectionTitle}>Narration</Text>
            <View style={s.fieldBlock}>
              <View style={s.field}>
                <Text style={s.label}>Notes</Text>
                <TextInput
                  style={s.textarea}
                  placeholder="Enter Notes"
                  placeholderTextColor={COLORS.textTertiary}
                  value={narration}
                  onChangeText={setNarration}
                  multiline
                  numberOfLines={4}
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
            style={[s.btnPrimary, (!!canSubmit || submitting) && { opacity: 0.6 }]}
            onPress={handleSubmit}
            activeOpacity={0.8}
            disabled={!!canSubmit || submitting}
          >
            {submitting
              ? <ActivityIndicator size="small" color={COLORS.white} />
              : <Ionicons name="send" size={16} color={COLORS.white} />}
            <Text style={s.btnPriTxt}>{submitting ? t('voucher.submitting') : t('voucher.submitContra')}</Text>
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

      <CashCountSheet
        visible={showCashSheet}
        onClose={() => setShowCashSheet(false)}
        targetAmount={amtNum}
        currency={settings.currency}
        initialCounts={cashCount?.used ? cashCount.denominations : null}
        onApply={(r) => setCashCount(r)}
        onClear={() => setCashCount(null)}
      />

      {/* Success Overlay — full-screen Modal + flex backdrop */}
      <Modal
        visible={!!(showSuccess && submitResult)}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={() => { setShowSuccess(false); router.back(); }}
      >
        <View style={s.successOverlay}>
          <View style={s.successCard}>
            <Ionicons name="checkmark-circle" size={48} color={COLORS.positive} />
            <Text style={s.successTitle}>{t('voucher.contraSaved')}</Text>
            <Text style={s.successSub}>
              {submitResult?.isQueued ? 'Queued for Tally sync' : 'Posted to Tally'}
            </Text>
            {!!submitResult?.tdkRef && <Text style={s.successRef}>{submitResult.tdkRef}</Text>}
            <TouchableOpacity
              style={[s.btnPrimary, { width: '100%' }]}
              onPress={() => {
                setShowSuccess(false);
                if (submitResult?.tdkRef) {
                  router.replace(`/voucher/contra-preview?tdkRef=${encodeURIComponent(submitResult.tdkRef)}` as any);
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
                if (!submitResult?.tdkRef || !company?.guid) return;
                setSharePdfLoading(true);
                try {
                  await shareVoucherPdfByRef(submitResult.tdkRef, company.guid, {
                    documentType: 'contra_voucher',
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
      </Modal>
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
  transferRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  transferBox: {
    flex: 1, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1,
    borderColor: COLORS.borderDefault, padding: 14, alignItems: 'center', gap: 6,
  },
  transferLabel: {
    fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  transferName: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  transferMid: { alignItems: 'center', gap: 6 },
  transferArrow: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.brandPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  transferAmt: { fontSize: TYPOGRAPHY.xs, fontWeight: '800', color: COLORS.textPrimary },
  section: { gap: 8 },
  sectionTitle: {
    fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginLeft: 2,
  },
  fieldBlock: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1,
    borderColor: COLORS.borderDefault, overflow: 'hidden',
  },
  field: { paddingHorizontal: SPACING.md, paddingVertical: 14 },
  label: {
    fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary,
    marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.3,
  },
  req: { color: COLORS.negative },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: COLORS.borderDefault,
    borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: COLORS.pageBg,
  },
  input: { flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  rupee: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textSecondary },
  textarea: {
    borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, padding: 12,
    fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, backgroundColor: COLORS.pageBg, minHeight: 100,
  },
  div: { height: 1, backgroundColor: COLORS.borderDefault },
  cashCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1,
    borderColor: COLORS.borderDefault, padding: SPACING.md, gap: 10,
  },
  cashMatched: { borderColor: COLORS.positive },
  cashMismatch: { borderColor: COLORS.negative },
  cashLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  cashIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cashTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  cashSub: { fontSize: 12, color: COLORS.textTertiary, marginTop: 2 },
  cashAction: { fontSize: 13, fontWeight: '700', color: COLORS.brandPrimary },
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.lg, paddingVertical: 16, marginTop: 8,
  },
  btnPriTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.white },
  pdfBtn: { flexDirection: 'row', gap: 8, backgroundColor: COLORS.brandPrimary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 20, width: '100%', justifyContent: 'center', alignItems: 'center' },
  pdfBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
  successOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  successCard: {
    width: '100%', backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: 24,
    alignItems: 'center', gap: 10,
  },
  successTitle: { fontSize: TYPOGRAPHY.lg, fontWeight: '800', color: COLORS.textPrimary },
  successSub: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  successRef: { fontSize: 12, fontWeight: '600', color: COLORS.brandPrimary, marginTop: 4 },
});

