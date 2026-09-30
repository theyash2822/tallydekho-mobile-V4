/**
 * Create Payment Voucher — full rewrite (2026-07-13)
 * Mirrors create-receipt.tsx (Receipt = gold standard).
 *
 *   • Regular → date locked today; Optional → FY DatePicker
 *   • Numbering from Settings only (TDK-PAY when tallydekho_series)
 *   • Party = Sundry Creditors → Expenses → All ledgers (tap filter to cycle)
 *   • Outstanding = Cr-only payables; FIFO + leftover On Account/Advance
 *   • Methods: Cash/Bank/Cheque/NEFT/RTGS/UPI + instruments
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Modal, Keyboard,
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
  createPaymentVoucher, getParties, getBankLedgers, getPartyOutstandingBills,
} from '../../src/services/api';
import { useNumberingPolicy } from '../../src/hooks/useNumberingPolicy';
import { useRbasCreate } from '../../src/hooks/useRbasCreate';
import { shareVoucherPdfByRef } from '../../src/utils/voucherPdf';
import { useTranslation } from 'react-i18next';
import { todayLocalISO } from '../../src/utils/periodDates';
import { useRequireCapability } from '../../src/components/RequireCapability';

// ── Helpers (mirrors create-invoice.tsx) ─────────────────────────────────────
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
const fmtINR = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

const PAYMENT_METHODS = ['Cash', 'Bank', 'Cheque', 'NEFT', 'RTGS', 'UPI'] as const;
type PaymentMethod = typeof PAYMENT_METHODS[number];

const REF_LABEL_KEYS: Record<PaymentMethod, string> = {
  Cash: '',
  Bank: 'screens.voucherCreatePayment.refBank',
  Cheque: 'screens.voucherCreatePayment.refCheque',
  NEFT: 'screens.voucherCreatePayment.refNeft',
  RTGS: 'screens.voucherCreatePayment.refRtgs',
  UPI: 'screens.voucherCreatePayment.refUpi',
};

const METHOD_LABEL_KEYS: Record<PaymentMethod, string> = {
  Cash: 'screens.voucherCreatePayment.methodCash',
  Bank: 'screens.voucherCreatePayment.methodBank',
  Cheque: 'screens.voucherCreatePayment.methodCheque',
  NEFT: '',
  RTGS: '',
  UPI: '',
};

type LeftoverType = 'On Account' | 'Advance';

const LEFTOVER_LABEL_KEYS: Record<LeftoverType, string> = {
  'On Account': 'screens.voucherCreatePayment.onAccount',
  Advance: 'screens.voucherCreatePayment.advance',
};

interface BillRow {
  bill_name: string;
  bill_date: string | null;
  due_date: string | null;
  amount: number;
  pending_amount: number;
  bill_type: string | null;
  selected: boolean;
  payAmount: string; // string for controlled input; '' = 0
}

export default function CreatePaymentVoucher() {
  const allowed = useRequireCapability('payment.create');
  const { t } = useTranslation();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const narrationY = useRef(0);
  const scrollNarrationIntoView = () => {
    // Same pattern as Sales Invoice: wait for keyboard, then scroll field above it.
    setTimeout(() => {
      scrollRef.current?.scrollTo?.({ y: Math.max(0, narrationY.current - 100), animated: true });
    }, 250);
  };
  const { company, selectedFY } = useAuth();
  const { } = useSettings();
  const fyStart = selectedFY?.startDate || `${new Date().getFullYear()}-04-01`;

  // ── Header state ──────────────────────────────────────────────────────────
  const {entryMode, entryType, setEntryType, scopeParties, assertCanCreate} = useRbasCreate();
  // Universal numbering — Settings → Voucher Config only (no on-screen override)
  const { numberingPolicy } = useNumberingPolicy(company?.guid);

  // ── Date (mirrors Sales Invoice pattern) ──────────────────────────────────
  const [date, setDate] = useState(todayStr());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [prevEntryType, setPrevEntryType] = useState(entryType);
  if (prevEntryType !== entryType) {
    setPrevEntryType(entryType);
    // If user flips to Regular, snap date back to today.
    if (entryType === 'regular') setDate(todayStr());
  }

  // ── Party picker (Creditors → Expenses → All) ─────────────────────────────
  type PartyFilter = 'vendor' | 'expense' | 'all';
  const [partyFilter, setPartyFilter] = useState<PartyFilter>('vendor');
  const [parties, setParties] = useState<BSSOption[]>([]);
  const [party, setParty] = useState('');
  const [partyData, setPartyData] = useState<any>(null);

  const partyFilterLabel =
    partyFilter === 'vendor' ? t('screens.voucherCreatePayment.filterCreditors')
      : partyFilter === 'expense' ? t('screens.voucherCreatePayment.filterExpenses')
        : t('screens.voucherCreatePayment.filterAll');

  const cyclePartyFilter = () => {
    setPartyFilter(prev => (prev === 'vendor' ? 'expense' : prev === 'expense' ? 'all' : 'vendor'));
    setParty('');
    setPartyData(null);
  };

  useEffect(() => {
    async function loadParties() {
      const guid = company?.guid;
      if (!guid) return;
      try {
        const params =
          partyFilter === 'vendor' ? { type: 'vendor' }
            : partyFilter === 'expense' ? { type: 'expense' }
              : undefined;
        const res: any = await getParties(guid, params);
        const list = scopeParties(res?.data || []).map((p: any) => ({
          label: p.name,
          value: p.name,
          subtitle: p.parent || undefined,
          data: p,
        }));
        setParties(list);
      } catch (e) { /* silent */ }
    }
    loadParties();
  }, [company?.guid, partyFilter, scopeParties]);

  // ── Outstanding bills for selected party ──────────────────────────────────
  const [bills, setBills] = useState<BillRow[]>([]);
  const [billsLoading, setBillsLoading] = useState(false);
  const [totalPending, setTotalPending] = useState(0);

  const [prevBillsKey, setPrevBillsKey] = useState<{ guid?: string; party: string } | null>(null);
  if (prevBillsKey === null || prevBillsKey.guid !== company?.guid || prevBillsKey.party !== party) {
    setPrevBillsKey({ guid: company?.guid, party });
    if (!company?.guid || !party) { setBills([]); setTotalPending(0); }
    else setBillsLoading(true);
  }

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const guid = company?.guid;
      if (!guid || !party) return;
      try {
        const res: any = await getPartyOutstandingBills(guid, party, { crOnly: true });
        if (cancelled) return;
        const rows: BillRow[] = (res?.data?.bills || []).map((b: any) => ({
          bill_name: b.bill_name || '',
          bill_date: b.bill_date || null,
          due_date: b.due_date || null,
          amount: parseFloat(b.amount) || 0,
          pending_amount: parseFloat(b.pending_amount) || 0,
          bill_type: b.bill_type || null,
          selected: false,
          payAmount: '',
        }));
        // Oldest bill first (API already sorts; keep stable client-side too)
        rows.sort((a, b) => {
          if (!a.bill_date && !b.bill_date) return 0;
          if (!a.bill_date) return 1;
          if (!b.bill_date) return -1;
          return String(a.bill_date).localeCompare(String(b.bill_date));
        });
        setBills(rows);
        setTotalPending(parseFloat(res?.data?.totalPending) || 0);
      } catch (e) {
        if (!cancelled) { setBills([]); setTotalPending(0); }
      } finally {
        if (!cancelled) setBillsLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [company?.guid, party]);

  // ── Amount + Payment ──────────────────────────────────────────────────────
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [ledgerAccount, setLedgerAccount] = useState('');
  const [ledgerOptions, setLedgerOptions] = useState<BSSOption[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [refNo, setRefNo] = useState('');
  // Instrument fields (Cheque/NEFT/RTGS)
  const [instrumentDate, setInstrumentDate] = useState('');
  const [showInstrumentDatePicker, setShowInstrumentDatePicker] = useState(false);
  const [bankName, setBankName] = useState('');
  const [narration, setNarration] = useState('');

  // Clear bill allocations when payment amount is cleared / zero
  const [prevAmount, setPrevAmount] = useState(amount);
  if (prevAmount !== amount) {
    setPrevAmount(amount);
    const n = parseFloat(amount);
    if (!amount || !Number.isFinite(n) || n <= 0) {
      setBills(prev => {
        if (!prev.some(b => b.selected || b.payAmount)) return prev;
        return prev.map(b => ({ ...b, selected: false, payAmount: '' }));
      });
    }
  }

  // Load ledger dropdown per payment method (Cash → cash, else → bank)
  const ledgerDeps = [company?.guid, paymentMethod, scopeParties];
  const [prevLedgerDeps, setPrevLedgerDeps] = useState<unknown[] | null>(null);
  if (prevLedgerDeps === null || ledgerDeps.some((d, i) => d !== prevLedgerDeps[i])) {
    setPrevLedgerDeps(ledgerDeps);
    if (company?.guid) {
      setLedgerLoading(true);
      setLedgerAccount('');
    }
  }

  useEffect(() => {
    async function fetchLedgers() {
      const guid = company?.guid;
      if (!guid) return;
      try {
        const type: 'cash' | 'bank' = paymentMethod === 'Cash' ? 'cash' : 'bank';
        const res: any = await getBankLedgers(guid, type);
        const list = scopeParties(res?.data || []).map((l: any) => ({
          label: l.closing_balance != null
            ? `${l.name} — ${fmtINR(Math.abs(parseFloat(l.closing_balance)))} ${parseFloat(l.closing_balance) < 0 ? 'Cr' : 'Dr'}`
            : l.name,
          value: l.name,
          data: l,
        }));
        setLedgerOptions(list);
      } catch (e) {
        setLedgerOptions([]);
      } finally { setLedgerLoading(false); }
    }
    fetchLedgers();
  }, [company?.guid, paymentMethod, scopeParties]);

  // ── Leftover disposition ──────────────────────────────────────────────────
  const [leftoverType, setLeftoverType] = useState<LeftoverType>('On Account');
  const [showLeftoverPicker, setShowLeftoverPicker] = useState(false);

  // ── Live allocation math ──────────────────────────────────────────────────
  const paymentAmt = parseFloat(amount) || 0;
  const allocated = bills.reduce((s, b) => s + (b.selected ? (parseFloat(b.payAmount) || 0) : 0), 0);
  const remaining = Math.max(0, paymentAmt - allocated);
  const overAllocated = allocated > paymentAmt + 0.01;

  // ── Bill list actions ─────────────────────────────────────────────────────
  const toggleBill = (idx: number) => {
    setBills(prev => prev.map((b, i) => i === idx ? { ...b, selected: !b.selected, payAmount: !b.selected ? String(Math.min(b.pending_amount, Math.max(0, paymentAmt - (allocated - (b.selected ? parseFloat(b.payAmount) || 0 : 0))))) : '' } : b));
  };
  const editBillAmount = (idx: number, val: string) => {
    setBills(prev => prev.map((b, i) => i === idx ? { ...b, payAmount: val, selected: parseFloat(val) > 0 ? true : b.selected } : b));
  };
  const fifoAutoAllocate = () => {
    if (!paymentAmt) { Alert.alert(t('voucher.enterAmountFirst')); return; }
    let remain = paymentAmt;
    setBills(prev => prev.map(b => {
      if (remain <= 0) return { ...b, selected: false, payAmount: '' };
      const pay = Math.min(b.pending_amount, remain);
      remain -= pay;
      return { ...b, selected: pay > 0, payAmount: pay > 0 ? String(pay) : '' };
    }));
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ tdkRef: string; isQueued: boolean; voucherNumber?: string; numberingPolicy?: string } | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [sharePdfLoading, setSharePdfLoading] = useState(false);

  const canSubmit = useMemo(() => {
    if (!party) return t('screens.voucherCreatePayment.selectParty');
    if (!paymentAmt || paymentAmt <= 0) return t('screens.voucherCreatePayment.enterValidAmount');
    if (!ledgerAccount) return paymentMethod === 'Cash' ? t('screens.voucherCreatePayment.selectCashLedger') : t('screens.voucherCreatePayment.selectBankLedger');
    if (overAllocated) return t('screens.voucherCreatePayment.allocatedExceeds');
    if (paymentMethod !== 'Cash' && paymentMethod !== 'UPI' && paymentMethod !== 'Bank' && !instrumentDate) return t('screens.voucherCreatePayment.instrumentDateRequired');
    return null;
  }, [party, paymentAmt, ledgerAccount, paymentMethod, overAllocated, instrumentDate, t]);

  const buildBillAllocations = () => {
    const blocks: { billRefName?: string; billType: string; amount: number }[] = [];
    bills.forEach(b => {
      const amt = parseFloat(b.payAmount) || 0;
      if (b.selected && amt > 0) {
        blocks.push({ billRefName: b.bill_name, billType: 'Agst Ref', amount: amt });
      }
    });
    // Leftover: default On Account (no NAME). Advance MUST have NAME (Tally rule — same as Payment).
    if (remaining > 0.01) {
      if (leftoverType === 'Advance') {
        blocks.push({
          billType: 'Advance',
          billRefName: `TDK-ADV-${Date.now().toString().slice(-6)}`,
          amount: remaining,
        });
      } else {
        blocks.push({ billType: 'On Account', amount: remaining });
      }
    }
    return blocks;
  };

  const handleSubmit = async () => {
    if (canSubmit) { Alert.alert(t('voucher.required'), canSubmit); return; }
    if (!assertCanCreate('payment.create')) return;
    setSubmitting(true);
    try {
      const wantsInstrument = ['Cheque', 'NEFT', 'RTGS'].includes(paymentMethod);
      const payload = {
        companyGuid: company?.guid,
        companyName: company?.name,
        date: dmyToISO(date),
        amount: paymentAmt,
        partyLedger: party,
        ledgerAccount,
        paymentMethod,
        billAllocations: buildBillAllocations(),
        instrumentDetails: wantsInstrument ? {
          instrumentNo: refNo || undefined,
          instrumentDate: instrumentDate ? dmyToISO(instrumentDate) : undefined,
          bankName: bankName || undefined,
          transactionType: undefined,
        } : undefined,
        entryType,
        numbering_policy: numberingPolicy,
        reference: refNo || undefined,
        narration: narration || undefined,
      };
      const res: any = await createPaymentVoucher(payload);
      const tdkRef = res?.tdkRef || res?.tdkReferenceNo || res?.data?.tdkRef || '';
      const isQueued = res?.queued === true;
      setSubmitResult({ tdkRef, isQueued, voucherNumber: res?.voucherNumber || undefined, numberingPolicy: res?.numberingPolicy || numberingPolicy });
      setShowSuccess(true);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: t('screens.voucherCreatePayment.submitFailed'), text2: e?.message || t('screens.voucherCreatePayment.checkTallyConnection') });
    } finally {
      setSubmitting(false);
    }
  };

  const partyOutstandingLabel = partyData?.balance ? fmtINR(Math.abs(parseFloat(partyData.balance || 0))) : null;

  if (!allowed) return null;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={s.hdr}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.hdrTitle}>{t('voucher.paymentTitle')}</Text>
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
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={Keyboard.dismiss}
        >

          {/* ── Payment No. + Date (mirrors Sales Invoice layout) ───── */}
          <View style={s.section}>
            <View style={[s.fieldBlock, { padding: SPACING.md }]}>
              <View style={s.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={s.fLabel}>{t('voucher.paymentNo')}</Text>
                  <View style={s.autoBox}>
                    <Text style={s.autoTxt}>{t('screens.voucherCreatePayment.auto')}</Text>
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
                        {date || t('screens.voucherCreatePayment.selectDate')}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          </View>

          {/* ── Party ────────────────────────────────────────────────── */}
          <View style={s.section}>
            <View style={s.sectionHead}>
              <Text style={s.sectionTitle}>{t('screens.voucherCreatePayment.partyLedgerSection')}</Text>
              <TouchableOpacity onPress={cyclePartyFilter} activeOpacity={0.8}>
                <Text style={s.linkTxt}>{partyFilterLabel}</Text>
              </TouchableOpacity>
            </View>
            <BottomSheetSearch
              label={partyFilter === 'expense' ? t('screens.voucherCreatePayment.expenseLedger') : t('screens.voucherCreatePayment.partyLedger')}
              required
              placeholder={
                partyFilter === 'expense' ? t('screens.voucherCreatePayment.searchExpense')
                  : partyFilter === 'all' ? t('screens.voucherCreatePayment.searchAnyLedger')
                    : t('screens.voucherCreatePayment.searchParty')
              }
              options={parties}
              value={party}
              onSelect={(opt) => { setParty(opt.value); setPartyData(opt.data || null); }}
              onClear={() => { setParty(''); setPartyData(null); }}
            />
            {partyFilter === 'expense' && !party && (
              <Text style={s.hintTxt}>
                {t('screens.voucherCreatePayment.expenseFilterHint')}
              </Text>
            )}
            {!!party && (
              <View style={s.chipRow}>
                {!!partyData?.parent && (
                  <View style={s.chip}><Text style={s.chipTxt}>{partyData.parent}</Text></View>
                )}
                {!!partyData?.gstin && <View style={s.chip}><Text style={s.chipTxt}>{t('screens.voucherCreatePayment.gstinValue', { gstin: partyData.gstin })}</Text></View>}
                {totalPending > 0 && (
                  <View style={[s.chip, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B44' }]}>
                    <Text style={[s.chipTxt, { color: '#92400E' }]}>{t('screens.voucherCreatePayment.outstandingValue', { amount: fmtINR(totalPending) })}</Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* ── Amount ──────────────────────────────────────────────── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('screens.voucherCreatePayment.paymentAmount')}</Text>
            <View style={s.fieldBlock}>
              <View style={s.field}>
                <View style={s.inputWrap}>
                  <Text style={s.rupee}>₹</Text>
                  <TextInput
                    style={s.input}
                    placeholder={t('voucher.enterAmount')}
                    placeholderTextColor={COLORS.textTertiary}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </View>
          </View>

          {/* ── Bill allocation ──────────────────────────────────────── */}
          {!!party && (
            <View style={s.section}>
              <View style={s.sectionHead}>
                <Text style={s.sectionTitle}>{t('screens.voucherCreatePayment.billAllocation')}</Text>
                {bills.length > 0 && (
                  <TouchableOpacity onPress={fifoAutoAllocate} activeOpacity={0.7}>
                    <Text style={s.linkTxt}>{t('screens.voucherCreatePayment.autoFifo')}</Text>
                  </TouchableOpacity>
                )}
              </View>

              {billsLoading ? (
                <View style={s.emptyBlock}><ActivityIndicator size="small" color={COLORS.brandPrimary} /></View>
              ) : bills.length === 0 ? (
                <View style={s.emptyBlock}>
                  <Ionicons name="information-circle-outline" size={20} color={COLORS.textTertiary} />
                  <Text style={s.emptyTxt}>{t('screens.voucherCreatePayment.noBills')}</Text>
                  <Text style={s.emptySub}>{t('screens.voucherCreatePayment.noBillsSub')}</Text>
                </View>
              ) : (
                <View style={s.fieldBlock}>
                  {bills.map((b, i) => (
                    <View key={`${i}-${b.bill_name || 'bill'}`} style={s.billRow}>
                      <TouchableOpacity onPress={() => toggleBill(i)} style={s.billCheck} activeOpacity={0.7}>
                        <Ionicons
                          name={b.selected ? 'checkbox' : 'square-outline'}
                          size={22}
                          color={b.selected ? COLORS.brandPrimary : COLORS.textTertiary}
                        />
                      </TouchableOpacity>
                      <View style={{ flex: 1 }}>
                        <Text style={s.billName}>{b.bill_name}</Text>
                        <Text style={s.billMeta}>
                          {b.bill_date ? new Date(b.bill_date).toLocaleDateString('en-IN') : '—'}
                          {b.due_date ? ` · ${t('screens.voucherCreatePayment.dueValue', { date: new Date(b.due_date).toLocaleDateString('en-IN') })}` : ''}
                          {' · '}{t('screens.voucherCreatePayment.pendingValue', { amount: fmtINR(b.pending_amount) })}
                        </Text>
                      </View>
                      <View style={s.billPay}>
                        <Text style={s.rupee}>₹</Text>
                        <TextInput
                          style={s.billPayInput}
                          value={b.payAmount}
                          onChangeText={(v) => editBillAmount(i, v)}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor={COLORS.textTertiary}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Live footer + leftover disposition */}
              {paymentAmt > 0 && (
                <View style={s.allocFooter}>
                  <View style={s.allocRow}>
                    <Text style={s.allocLbl}>{t('screens.voucherCreatePayment.paymentAmountColon')}</Text>
                    <Text style={s.allocVal}>{fmtINR(paymentAmt)}</Text>
                  </View>
                  <View style={s.allocRow}>
                    <Text style={s.allocLbl}>{t('screens.voucherCreatePayment.allocatedColon')}</Text>
                    <Text style={[s.allocVal, overAllocated && { color: COLORS.negative }]}>{fmtINR(allocated)}</Text>
                  </View>
                  {remaining > 0.01 && (
                    <View style={s.allocRow}>
                      <Text style={s.allocLbl}>{t('screens.voucherCreatePayment.remainingColon')}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={s.allocVal}>{fmtINR(remaining)}</Text>
                        <TouchableOpacity style={s.leftoverPill} onPress={() => setShowLeftoverPicker(true)} activeOpacity={0.7}>
                          <Text style={s.leftoverPillTxt}>{t(LEFTOVER_LABEL_KEYS[leftoverType])}</Text>
                          <Ionicons name="chevron-down" size={14} color={COLORS.brandPrimary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                  {overAllocated && (
                    <Text style={s.errTxt}>{t('screens.voucherCreatePayment.overAllocatedWarning')}</Text>
                  )}
                </View>
              )}
            </View>
          )}

          {/* ── Payment Method ──────────────────────────────────────── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('screens.voucherCreatePayment.paymentMethod')}</Text>
            <View style={s.fieldBlock}>
              <View style={s.field}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }} contentContainerStyle={s.pillRowScroll}>
                  {PAYMENT_METHODS.map(m => (
                    <TouchableOpacity
                      key={m}
                      style={[s.pill, paymentMethod === m && s.pillActive]}
                      onPress={() => setPaymentMethod(m)}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.pillTxt, paymentMethod === m && s.pillActiveTxt]}>{METHOD_LABEL_KEYS[m] ? t(METHOD_LABEL_KEYS[m]) : m}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={s.div} />
              <View style={s.field}>
                <Text style={s.label}>{paymentMethod === 'Cash' ? t('screens.voucherCreatePayment.cashLedger') : t('screens.voucherCreatePayment.bankLedger')} <Text style={s.req}>*</Text></Text>
                <BottomSheetSearch
                  label={paymentMethod === 'Cash' ? t('screens.voucherCreatePayment.cashLedger') : t('screens.voucherCreatePayment.bankLedger')}
                  placeholder={ledgerLoading ? t('common.loading') : paymentMethod === 'Cash' ? t('screens.voucherCreatePayment.searchCashLedger') : t('screens.voucherCreatePayment.searchBankLedger')}
                  options={ledgerOptions}
                  value={ledgerAccount}
                  onSelect={(opt) => setLedgerAccount(opt.value)}
                  onClear={() => setLedgerAccount('')}
                />
              </View>

              {paymentMethod !== 'Cash' && (
                <>
                  <View style={s.div} />
                  <View style={s.field}>
                    <Text style={s.label}>{t(REF_LABEL_KEYS[paymentMethod])}</Text>
                    <View style={s.inputWrap}>
                      <Ionicons name="keypad-outline" size={16} color={COLORS.textTertiary} />
                      <TextInput
                        style={s.input}
                        placeholder={t('screens.voucherCreatePayment.enterRef', { label: t(REF_LABEL_KEYS[paymentMethod]).toLowerCase() })}
                        placeholderTextColor={COLORS.textTertiary}
                        value={refNo}
                        onChangeText={setRefNo}
                      />
                    </View>
                  </View>
                </>
              )}

              {(paymentMethod === 'Cheque' || paymentMethod === 'NEFT' || paymentMethod === 'RTGS') && (
                <>
                  <View style={s.div} />
                  <View style={s.field}>
                    <Text style={s.label}>{t('screens.voucherCreatePayment.instrumentDate')}</Text>
                    <TouchableOpacity style={s.inputWrap} onPress={() => setShowInstrumentDatePicker(true)}>
                      <Ionicons name="calendar-outline" size={16} color={COLORS.textTertiary} />
                      <Text style={{ flex: 1, color: instrumentDate ? COLORS.textPrimary : COLORS.textTertiary }}>{instrumentDate || t('screens.voucherCreatePayment.selectInstrumentDate')}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={s.div} />
                  <View style={s.field}>
                    <Text style={s.label}>{t('screens.voucherCreatePayment.bankName')}</Text>
                    <View style={s.inputWrap}>
                      <Ionicons name="business-outline" size={16} color={COLORS.textTertiary} />
                      <TextInput
                        style={s.input}
                        placeholder={t('screens.voucherCreatePayment.bankNamePlaceholder')}
                        placeholderTextColor={COLORS.textTertiary}
                        value={bankName}
                        onChangeText={setBankName}
                      />
                    </View>
                  </View>
                </>
              )}
            </View>
          </View>

          {/* ── Narration ──────────────────────────────────────────── */}
          <View
            style={s.section}
            onLayout={(e) => { narrationY.current = e.nativeEvent.layout.y; }}
          >
            <Text style={s.sectionTitle}>{t('voucher.narration')}</Text>
            <View style={s.fieldBlock}>
              <View style={s.field}>
                <TextInput
                  style={s.textarea}
                  placeholder={t('screens.voucherCreatePayment.notesOptional')}
                  placeholderTextColor={COLORS.textTertiary}
                  value={narration}
                  onChangeText={setNarration}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  onFocus={scrollNarrationIntoView}
                />
              </View>
            </View>
          </View>

          {/* ── Submit ─────────────────────────────────────────────── */}
          <TouchableOpacity
            style={[s.btnPrimary, (submitting || !!canSubmit) && { opacity: 0.6 }]}
            onPress={handleSubmit}
            activeOpacity={0.8}
            disabled={submitting || !!canSubmit}
          >
            {submitting
              ? <ActivityIndicator size="small" color={COLORS.white} />
              : <Ionicons name="send" size={16} color={COLORS.white} />}
            <Text style={s.btnPriTxt}>{submitting ? t('voucher.submitting') : t('screens.voucherCreatePayment.submitBtn')}</Text>
          </TouchableOpacity>
          {/* Extra space so keyboard doesn't cover narration/submit */}
          <View style={{ height: 24 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Leftover picker sheet ─────────────────────────────────── */}
      <Modal visible={showLeftoverPicker} transparent animationType="fade" onRequestClose={() => setShowLeftoverPicker(false)}>
        <TouchableOpacity style={ss.overlay} activeOpacity={1} onPress={() => setShowLeftoverPicker(false)}>
          <View style={ss.sheetCard}>
            <Text style={ss.sheetTitle}>{t('screens.voucherCreatePayment.leftoverTitle')}</Text>
            <Text style={{ fontSize: 12, color: COLORS.textTertiary, marginBottom: 4, lineHeight: 16 }}>
              {t('screens.voucherCreatePayment.leftoverHint')}
            </Text>
            {(['On Account', 'Advance'] as LeftoverType[]).map(opt => (
              <TouchableOpacity
                key={opt}
                style={[ss.sheetOpt, leftoverType === opt && ss.sheetOptActive]}
                onPress={() => { setLeftoverType(opt); setShowLeftoverPicker(false); }}
                activeOpacity={0.7}
              >
                <Text style={[ss.sheetOptTxt, leftoverType === opt && ss.sheetOptActiveTxt]}>{t(LEFTOVER_LABEL_KEYS[opt])}</Text>
                {leftoverType === opt && <Ionicons name="checkmark" size={18} color={COLORS.brandPrimary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Success Overlay — full-screen Modal + flex backdrop */}
      <Modal
        visible={!!(showSuccess && submitResult)}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={() => { setShowSuccess(false); router.back(); }}
      >
        <View style={ss.overlay2}>
          {submitResult && (
            <View style={ss.card}>
              <View style={ss.iconWrap}>
                <Ionicons
                  name={submitResult.isQueued ? 'time-outline' : 'checkmark-circle'}
                  size={56}
                  color={submitResult.isQueued ? COLORS.warning : COLORS.positive}
                />
              </View>
              <Text style={ss.title}>{submitResult.isQueued ? t('screens.voucherCreatePayment.savedPendingSync') : t('screens.voucherCreatePayment.submitted')}</Text>
              <Text style={ss.sub}>
                {submitResult.isQueued
                  ? t('screens.voucherCreatePayment.entryQueued')
                  : t('screens.voucherCreatePayment.pushed')}
              </Text>
              {submitResult.numberingPolicy === 'tallydekho_series' && submitResult.voucherNumber && (
                <View style={[ss.refBadge, { backgroundColor: '#F0FDF4', borderColor: '#22C55E44' }]}>
                  <Text style={ss.refLabel}>{t('screens.voucherCreatePayment.voucherNo')}</Text>
                  <Text style={[ss.refVal, { color: '#166534' }]}>{submitResult.voucherNumber}</Text>
                </View>
              )}
              {!!submitResult.tdkRef && (
                <View style={ss.refBadge}>
                  <Text style={ss.refLabel}>{t('screens.voucherCreatePayment.refBank')}</Text>
                  <Text style={ss.refVal}>{submitResult.tdkRef}</Text>
                </View>
              )}
              <TouchableOpacity
                style={ss.previewBtn}
                activeOpacity={0.85}
                onPress={() => {
                  if (!submitResult?.tdkRef) return;
                  setShowSuccess(false);
                  router.replace(`/voucher/payment-preview?tdkRef=${encodeURIComponent(submitResult.tdkRef)}` as any);
                }}
              >
                <Ionicons name="eye-outline" size={18} color={COLORS.brandPrimary} />
                <Text style={ss.previewBtnTxt}>{t('screens.voucherCreatePayment.preview')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[ss.pdfBtn, sharePdfLoading && { opacity: 0.7 }]}
                activeOpacity={0.85}
                disabled={sharePdfLoading}
                onPress={async () => {
                  if (!submitResult.tdkRef || !company?.guid) return;
                  setSharePdfLoading(true);
                  try {
                    await shareVoucherPdfByRef(submitResult.tdkRef, company.guid, {
                      documentType: 'payment_voucher',
                      onBeforeShare: () => setSharePdfLoading(false),
                      fallback: async () => {
                        Toast.show({ type: 'info', text1: t('screens.voucherCreatePayment.sharingUnavailable') });
                      },
                    });
                  } catch (err: any) {
                    Toast.show({ type: 'error', text1: t('screens.voucherCreatePayment.pdfError'), text2: err?.message || t('screens.voucherCreatePayment.couldNotGeneratePdf') });
                  } finally {
                    setSharePdfLoading(false);
                  }
                }}
              >
                {sharePdfLoading
                  ? <ActivityIndicator size="small" color={COLORS.white} />
                  : <Ionicons name="document-outline" size={18} color={COLORS.white} />}
                <Text style={ss.pdfBtnTxt}>{sharePdfLoading ? t('screens.voucherCreatePayment.pdfCreating') : t('pdf.sharePdf')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={ss.closeBtn} activeOpacity={0.85} onPress={() => { setShowSuccess(false); router.back(); }}>
                <Text style={ss.closeBtnTxt}>{t('common.close')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      {/* Date pickers */}
      <DatePickerModal
        visible={showDatePicker}
        value={date}
        minDate={fyStart}
        maxDate={todayLocalISO()}
        onSelect={(d) => { setDate(d); setShowDatePicker(false); }}
        onClose={() => setShowDatePicker(false)}
      />
      <DatePickerModal
        visible={showInstrumentDatePicker}
        value={instrumentDate || todayStr()}
        maxDate={todayLocalISO()}
        onSelect={(d) => { setInstrumentDate(d); setShowInstrumentDatePicker(false); }}
        onClose={() => setShowInstrumentDatePicker(false)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  hdr: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  back: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center' },
  hdrTitle: { flex: 1, fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  scroll: { padding: SPACING.md, gap: 14 },
  section: { gap: 8 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 },
  sectionTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginLeft: 2 },
  linkTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.brandPrimary },
  fieldBlock: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  field: { paddingHorizontal: SPACING.md, paddingVertical: 12 },
  row2: { flexDirection: 'row', gap: 12 },
  fLabel: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  fInput: { backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, minHeight: 48, justifyContent: 'center' },
  autoBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, minHeight: 48 },
  autoTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '600' },
  label: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.3 },
  req: { color: COLORS.negative },
  star: { color: COLORS.negative },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: COLORS.pageBg },
  input: { flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  rupee: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textSecondary },
  textarea: { borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, padding: 12, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, backgroundColor: COLORS.pageBg, minHeight: 80 },
  pillRow: { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  pillRowScroll: { gap: 8, paddingVertical: 2 },
  pill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.borderDefault, backgroundColor: COLORS.pageBg },
  pillActive: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  pillTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  pillActiveTxt: { color: COLORS.white },
  div: { height: 1, backgroundColor: COLORS.borderDefault },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 6 },
  chip: { borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: COLORS.pageBg },
  chipTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '600' },
  billRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: SPACING.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  billCheck: { width: 26, alignItems: 'center' },
  billName: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  billMeta: { fontSize: 11, color: COLORS.textTertiary, marginTop: 2 },
  billPay: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, paddingHorizontal: 8, paddingVertical: 6, minWidth: 90, backgroundColor: COLORS.pageBg },
  billPayInput: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'right' },
  emptyBlock: { padding: 16, gap: 6, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg, alignItems: 'flex-start' },
  emptyTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  emptySub: { fontSize: 12, color: COLORS.textTertiary, lineHeight: 17 },
  hintTxt: { fontSize: 12, color: COLORS.textTertiary, marginTop: 8, lineHeight: 17 },
  allocFooter: { padding: 14, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg, gap: 6, marginTop: 2 },
  allocRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  allocLbl: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '600' },
  allocVal: { fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, fontWeight: '800' },
  leftoverPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: COLORS.brandPrimary + '55', borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: COLORS.brandPrimary + '11' },
  leftoverPillTxt: { fontSize: 11, fontWeight: '800', color: COLORS.brandPrimary },
  errTxt: { fontSize: 12, color: COLORS.negative, fontWeight: '600', marginTop: 2 },
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.lg, paddingVertical: 16, marginTop: 8,
  },
  btnPriTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.white },
});

const ss = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheetCard: { backgroundColor: COLORS.cardBg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32, gap: 8 },
  sheetTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  sheetOpt: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  sheetOptActive: { backgroundColor: COLORS.brandPrimary + '11', borderColor: COLORS.brandPrimary },
  sheetOptTxt: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, fontWeight: '600' },
  sheetOptActiveTxt: { color: COLORS.brandPrimary, fontWeight: '800' },
  overlay2: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 400, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: 24, alignItems: 'center', gap: 12 },
  iconWrap: { marginBottom: 4 },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  sub: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, textAlign: 'center' },
  refBadge: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, backgroundColor: COLORS.pageBg, minWidth: 220, alignItems: 'center' },
  refLabel: { fontSize: 11, color: COLORS.textTertiary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  refVal: { fontSize: TYPOGRAPHY.md, color: COLORS.textPrimary, fontWeight: '800', marginTop: 3 },
  previewBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 20, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.brandPrimary, minWidth: 220 },
  previewBtnTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.brandPrimary, fontWeight: '800' },
  pdfBtn: { flexDirection: 'row', gap: 8, backgroundColor: COLORS.brandPrimary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 20, minWidth: 220, justifyContent: 'center', alignItems: 'center' },
  pdfBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
  closeBtn: { paddingVertical: 10, paddingHorizontal: 16 },
  closeBtnTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary, fontWeight: '700' },
});
