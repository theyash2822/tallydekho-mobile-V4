/**
 * Create Receipt Voucher — full rewrite (2026-07-09)
 *
 * Universal rules mirrored from Sales Invoice (create-invoice.tsx):
 *   • Regular/Optional toggle in header (top-right)
 *   • Regular  → date LOCKED to today
 *     Optional → DatePickerModal (FY range, back-date allowed, no future)
 *   • Numbering policy: from Settings → Voucher Config only (no on-screen override)
 *   • On submit → success overlay with [Preview] button → routes to /voucher/receipt-preview
 *
 * Receipt-specific behaviors (per user 2026-07-09 / 2026-07-13):
 *   • Party picker = existing Sundry Debtors default + "Show all parties" toggle.
 *     NO "+ Add Customer" button (per user rule: only Sales/Purchase Invoice get inline add).
 *   • Party balance chip shown after party selected.
 *   • Payment method: Cash → Cash ledger dropdown | others → Bank ledger dropdown.
 *   • Multi-bill allocation with per-bill editable amounts + FIFO auto-allocate.
 *     Outstanding list = Dr-only (receivables), sorted by bill_date.
 *     Clearing receipt amount clears all bill allocations.
 *     Leftover disposition dropdown [On Account | Advance] appears when
 *     SUM(allocated) < Receipt amount.
 *   • Instrument details block (Instrument No + Date + Bank Name) for Cheque/NEFT/RTGS.
 *   • Ref label per method: Cash=hidden, Bank="Reference No.", Cheque="Cheque No.", ...
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import RegularOptionalToggle, { EntryType } from '../../src/components/forms/RegularOptionalToggle';
import DatePickerModal from '../../src/components/forms/DatePickerModal';
import BottomSheetSearch, { BSSOption } from '../../src/components/forms/BottomSheetSearch';
import { useAuth } from '../../src/context/AuthContext';
import { useSettings } from '../../src/context/SettingsContext';
import {
  createReceiptVoucher, getParties, getBankLedgers, getPartyOutstandingBills, getComplianceConfig,
} from '../../src/services/api';

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

const REF_LABELS: Record<PaymentMethod, string> = {
  Cash: '',
  Bank: 'Reference No.',
  Cheque: 'Cheque No.',
  NEFT: 'NEFT UTR',
  RTGS: 'RTGS UTR',
  UPI: 'UPI Ref ID',
};

type LeftoverType = 'On Account' | 'Advance';

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

export default function CreateReceiptVoucher() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const narrationY = useRef(0);
  const scrollNarrationIntoView = () => {
    setTimeout(() => {
      scrollRef.current?.scrollTo?.({ y: Math.max(0, narrationY.current - 100), animated: true });
    }, 250);
  };
  const { company, isPaired, selectedFY } = useAuth();
  const { } = useSettings();
  const fyStart = selectedFY?.startDate || `${new Date().getFullYear()}-04-01`;

  // ── Header state ──────────────────────────────────────────────────────────
  const [entryType, setEntryType] = useState<EntryType>('regular');
  // Numbering from Settings → Voucher Config only (no on-screen override)
  const [numberingPolicy, setNumberingPolicy] = useState<'tally_prime_series' | 'tallydekho_series'>('tally_prime_series');

  useEffect(() => {
    if (!company?.guid) return;
    getComplianceConfig(company.guid).then((res: any) => {
      const cfg = res?.data || res;
      if (cfg?.numbering_policy === 'tallydekho_series') {
        setNumberingPolicy('tallydekho_series');
      } else {
        setNumberingPolicy('tally_prime_series');
      }
    }).catch(() => {});
  }, [company?.guid]);

  // ── Date (mirrors Sales Invoice pattern) ──────────────────────────────────
  const [date, setDate] = useState(todayStr());
  const [showDatePicker, setShowDatePicker] = useState(false);
  useEffect(() => {
    // If user flips to Regular, snap date back to today.
    if (entryType === 'regular') setDate(todayStr());
  }, [entryType]);

  // ── Party picker ──────────────────────────────────────────────────────────
  const [showAllParties, setShowAllParties] = useState(false);
  const [parties, setParties] = useState<BSSOption[]>([]);
  const [party, setParty] = useState('');
  const [partyData, setPartyData] = useState<any>(null);

  const loadParties = useCallback(async () => {
    if (!company?.guid) return;
    try {
      const res: any = await getParties(company.guid, showAllParties ? undefined : 'customer');
      const list = (res?.data || []).map((p: any) => ({
        label: p.name, value: p.name, data: p,
      }));
      setParties(list);
    } catch (e) { /* silent */ }
  }, [company?.guid, showAllParties]);
  useEffect(() => { loadParties(); }, [loadParties]);

  // ── Outstanding bills for selected party ──────────────────────────────────
  const [bills, setBills] = useState<BillRow[]>([]);
  const [billsLoading, setBillsLoading] = useState(false);
  const [totalPending, setTotalPending] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!company?.guid || !party) { setBills([]); setTotalPending(0); return; }
      setBillsLoading(true);
      try {
        const res: any = await getPartyOutstandingBills(company.guid, party, { drOnly: true });
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

  // Clear bill allocations when receipt amount is cleared / zero
  useEffect(() => {
    const n = parseFloat(amount);
    if (!amount || !Number.isFinite(n) || n <= 0) {
      setBills(prev => {
        if (!prev.some(b => b.selected || b.payAmount)) return prev;
        return prev.map(b => ({ ...b, selected: false, payAmount: '' }));
      });
    }
  }, [amount]);

  // Load ledger dropdown per payment method (Cash → cash, else → bank)
  const fetchLedgers = useCallback(async () => {
    if (!company?.guid) return;
    setLedgerLoading(true);
    setLedgerAccount('');
    try {
      const type: 'cash' | 'bank' = paymentMethod === 'Cash' ? 'cash' : 'bank';
      const res: any = await getBankLedgers(company.guid, type);
      const list = (res?.data || []).map((l: any) => ({
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
  }, [company?.guid, paymentMethod]);
  useEffect(() => { fetchLedgers(); }, [fetchLedgers]);

  // ── Leftover disposition ──────────────────────────────────────────────────
  const [leftoverType, setLeftoverType] = useState<LeftoverType>('On Account');
  const [showLeftoverPicker, setShowLeftoverPicker] = useState(false);

  // ── Live allocation math ──────────────────────────────────────────────────
  const receiptAmt = parseFloat(amount) || 0;
  const allocated = bills.reduce((s, b) => s + (b.selected ? (parseFloat(b.payAmount) || 0) : 0), 0);
  const remaining = Math.max(0, receiptAmt - allocated);
  const overAllocated = allocated > receiptAmt + 0.01;

  // ── Bill list actions ─────────────────────────────────────────────────────
  const toggleBill = (idx: number) => {
    setBills(prev => prev.map((b, i) => i === idx ? { ...b, selected: !b.selected, payAmount: !b.selected ? String(Math.min(b.pending_amount, Math.max(0, receiptAmt - (allocated - (b.selected ? parseFloat(b.payAmount) || 0 : 0))))) : '' } : b));
  };
  const editBillAmount = (idx: number, val: string) => {
    setBills(prev => prev.map((b, i) => i === idx ? { ...b, payAmount: val, selected: parseFloat(val) > 0 ? true : b.selected } : b));
  };
  const fifoAutoAllocate = () => {
    if (!receiptAmt) { Alert.alert('Enter amount first'); return; }
    let remain = receiptAmt;
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

  const canSubmit = useMemo(() => {
    if (!party) return 'Select a party';
    if (!receiptAmt || receiptAmt <= 0) return 'Enter a valid amount';
    if (!ledgerAccount) return paymentMethod === 'Cash' ? 'Select a Cash ledger' : 'Select a Bank ledger';
    if (overAllocated) return 'Allocated amount exceeds receipt amount';
    if (paymentMethod !== 'Cash' && paymentMethod !== 'UPI' && paymentMethod !== 'Bank' && !instrumentDate) return 'Instrument date required';
    return null;
  }, [party, receiptAmt, ledgerAccount, paymentMethod, overAllocated, instrumentDate]);

  const buildBillAllocations = () => {
    const blocks: { billRefName?: string; billType: string; amount: number }[] = [];
    bills.forEach(b => {
      const amt = parseFloat(b.payAmount) || 0;
      if (b.selected && amt > 0) {
        blocks.push({ billRefName: b.bill_name, billType: 'Agst Ref', amount: amt });
      }
    });
    // Same Tally rule as Payment: Advance requires NAME; On Account does not.
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
    if (canSubmit) { Alert.alert('Required', canSubmit); return; }
    if (!isPaired) { Toast.show({ type: 'error', text1: 'Not Paired', text2: 'Pair with Tally Desktop first.' }); return; }
    setSubmitting(true);
    try {
      const wantsInstrument = ['Cheque', 'NEFT', 'RTGS'].includes(paymentMethod);
      const payload = {
        companyGuid: company?.guid,
        companyName: company?.name,
        date: dmyToISO(date),
        amount: receiptAmt,
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
      const res: any = await createReceiptVoucher(payload);
      const tdkRef = res?.tdkRef || res?.tdkReferenceNo || res?.data?.tdkRef || '';
      const isQueued = res?.queued === true;
      setSubmitResult({ tdkRef, isQueued, voucherNumber: res?.voucherNumber || undefined, numberingPolicy: res?.numberingPolicy || numberingPolicy });
      setShowSuccess(true);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Submit Failed', text2: e?.message || 'Check Tally connection.' });
    } finally {
      setSubmitting(false);
    }
  };

  const partyOutstandingLabel = partyData?.balance ? fmtINR(Math.abs(parseFloat(partyData.balance || 0))) : null;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={s.hdr}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.hdrTitle}>Receipt Voucher</Text>
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
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >

          {/* ── Receipt No. + Date (mirrors Sales Invoice layout) ───── */}
          <View style={s.section}>
            <View style={[s.fieldBlock, { padding: SPACING.md }]}>
              <View style={s.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={s.fLabel}>Receipt No.</Text>
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

          {/* ── Party ────────────────────────────────────────────────── */}
          <View style={s.section}>
            <View style={s.sectionHead}>
              <Text style={s.sectionTitle}>Party</Text>
              <TouchableOpacity onPress={() => setShowAllParties(v => !v)} activeOpacity={0.8}>
                <Text style={s.linkTxt}>{showAllParties ? '★ All parties' : 'Sundry Debtors ▾'}</Text>
              </TouchableOpacity>
            </View>
            <BottomSheetSearch
              label="Party Ledger" required
              placeholder="Search party..."
              options={parties}
              value={party}
              onSelect={(opt) => { setParty(opt.value); setPartyData(opt.data || null); }}
              onClear={() => { setParty(''); setPartyData(null); }}
            />
            {!!party && (
              <View style={s.chipRow}>
                {!!partyData?.gstin && <View style={s.chip}><Text style={s.chipTxt}>GSTIN: {partyData.gstin}</Text></View>}
                {totalPending > 0 && (
                  <View style={[s.chip, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B44' }]}>
                    <Text style={[s.chipTxt, { color: '#92400E' }]}>Outstanding: {fmtINR(totalPending)}</Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* ── Amount ──────────────────────────────────────────────── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Receipt Amount</Text>
            <View style={s.fieldBlock}>
              <View style={s.field}>
                <View style={s.inputWrap}>
                  <Text style={s.rupee}>₹</Text>
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

          {/* ── Bill allocation ──────────────────────────────────────── */}
          {!!party && (
            <View style={s.section}>
              <View style={s.sectionHead}>
                <Text style={s.sectionTitle}>Bill Allocation</Text>
                {bills.length > 0 && (
                  <TouchableOpacity onPress={fifoAutoAllocate} activeOpacity={0.7}>
                    <Text style={s.linkTxt}>⚡ Auto FIFO</Text>
                  </TouchableOpacity>
                )}
              </View>

              {billsLoading ? (
                <View style={s.emptyBlock}><ActivityIndicator size="small" color={COLORS.brandPrimary} /></View>
              ) : bills.length === 0 ? (
                <View style={s.emptyBlock}>
                  <Ionicons name="information-circle-outline" size={20} color={COLORS.textTertiary} />
                  <Text style={s.emptyTxt}>No receivable outstanding bills for this party.</Text>
                  <Text style={s.emptySub}>Only Dr (dues) bills are listed. Receipt will post as an advance / on-account entry.</Text>
                </View>
              ) : (
                <View style={s.fieldBlock}>
                  {bills.map((b, i) => (
                    <View key={b.bill_name + i} style={s.billRow}>
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
                          {b.due_date ? ` · Due ${new Date(b.due_date).toLocaleDateString('en-IN')}` : ''}
                          {' · Pending '}{fmtINR(b.pending_amount)}
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
              {receiptAmt > 0 && (
                <View style={s.allocFooter}>
                  <View style={s.allocRow}>
                    <Text style={s.allocLbl}>Receipt Amount:</Text>
                    <Text style={s.allocVal}>{fmtINR(receiptAmt)}</Text>
                  </View>
                  <View style={s.allocRow}>
                    <Text style={s.allocLbl}>Allocated:</Text>
                    <Text style={[s.allocVal, overAllocated && { color: COLORS.negative }]}>{fmtINR(allocated)}</Text>
                  </View>
                  {remaining > 0.01 && (
                    <View style={s.allocRow}>
                      <Text style={s.allocLbl}>Remaining:</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={s.allocVal}>{fmtINR(remaining)}</Text>
                        <TouchableOpacity style={s.leftoverPill} onPress={() => setShowLeftoverPicker(true)} activeOpacity={0.7}>
                          <Text style={s.leftoverPillTxt}>{leftoverType}</Text>
                          <Ionicons name="chevron-down" size={14} color={COLORS.brandPrimary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                  {overAllocated && (
                    <Text style={s.errTxt}>⚠ Allocated exceeds receipt amount — reduce bill amounts.</Text>
                  )}
                </View>
              )}
            </View>
          )}

          {/* ── Payment Method ──────────────────────────────────────── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Payment Method</Text>
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
                      <Text style={[s.pillTxt, paymentMethod === m && s.pillActiveTxt]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={s.div} />
              <View style={s.field}>
                <Text style={s.label}>{paymentMethod === 'Cash' ? 'Cash Ledger' : 'Bank Ledger'} <Text style={s.req}>*</Text></Text>
                <BottomSheetSearch
                  label={paymentMethod === 'Cash' ? 'Cash Ledger' : 'Bank Ledger'}
                  placeholder={ledgerLoading ? 'Loading...' : `Search ${paymentMethod === 'Cash' ? 'cash' : 'bank'} ledger...`}
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
                    <Text style={s.label}>{REF_LABELS[paymentMethod]}</Text>
                    <View style={s.inputWrap}>
                      <Ionicons name="keypad-outline" size={16} color={COLORS.textTertiary} />
                      <TextInput
                        style={s.input}
                        placeholder={`Enter ${REF_LABELS[paymentMethod].toLowerCase()}`}
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
                    <Text style={s.label}>Instrument Date</Text>
                    <TouchableOpacity style={s.inputWrap} onPress={() => setShowInstrumentDatePicker(true)}>
                      <Ionicons name="calendar-outline" size={16} color={COLORS.textTertiary} />
                      <Text style={{ flex: 1, color: instrumentDate ? COLORS.textPrimary : COLORS.textTertiary }}>{instrumentDate || 'Select instrument date'}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={s.div} />
                  <View style={s.field}>
                    <Text style={s.label}>Bank Name</Text>
                    <View style={s.inputWrap}>
                      <Ionicons name="business-outline" size={16} color={COLORS.textTertiary} />
                      <TextInput
                        style={s.input}
                        placeholder="e.g. HDFC Bank"
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
            <Text style={s.sectionTitle}>Narration</Text>
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
                  onFocus={scrollNarrationIntoView}
                />
              </View>
            </View>
          </View>

          {/* ── Submit ─────────────────────────────────────────────── */}
          <View style={s.btnRow}>
            <TouchableOpacity style={s.btnSecondary} onPress={() => router.back()} activeOpacity={0.8}>
              <Text style={s.btnSecTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btnPrimary, (submitting || !!canSubmit) && { opacity: 0.6 }]}
              onPress={handleSubmit}
              activeOpacity={0.8}
              disabled={submitting || !!canSubmit}
            >
              {submitting
                ? <ActivityIndicator size="small" color={COLORS.white} />
                : <Ionicons name="send" size={16} color={COLORS.white} />}
              <Text style={s.btnPriTxt}>{submitting ? 'Submitting...' : 'Submit Receipt'}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: 24 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Leftover picker sheet ─────────────────────────────────── */}
      <Modal visible={showLeftoverPicker} transparent animationType="fade" onRequestClose={() => setShowLeftoverPicker(false)}>
        <TouchableOpacity style={ss.overlay} activeOpacity={1} onPress={() => setShowLeftoverPicker(false)}>
          <View style={ss.sheetCard}>
            <Text style={ss.sheetTitle}>Remaining amount will post as</Text>
            <Text style={{ fontSize: 12, color: COLORS.textTertiary, marginBottom: 4, lineHeight: 16 }}>
              On Account needs no name. Advance gets an auto ref name (Tally requirement).
            </Text>
            {(['On Account', 'Advance'] as LeftoverType[]).map(opt => (
              <TouchableOpacity
                key={opt}
                style={[ss.sheetOpt, leftoverType === opt && ss.sheetOptActive]}
                onPress={() => { setLeftoverType(opt); setShowLeftoverPicker(false); }}
                activeOpacity={0.7}
              >
                <Text style={[ss.sheetOptTxt, leftoverType === opt && ss.sheetOptActiveTxt]}>{opt}</Text>
                {leftoverType === opt && <Ionicons name="checkmark" size={18} color={COLORS.brandPrimary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Success overlay (mirrors Sales Invoice) ─────────────── */}
      {showSuccess && submitResult && (
        <View style={ss.overlay2}>
          <View style={ss.card}>
            <View style={ss.iconWrap}>
              <Ionicons
                name={submitResult.isQueued ? 'time-outline' : 'checkmark-circle'}
                size={56}
                color={submitResult.isQueued ? COLORS.warning : COLORS.positive}
              />
            </View>
            <Text style={ss.title}>{submitResult.isQueued ? 'Saved. Pending Sync' : 'Receipt Submitted!'}</Text>
            <Text style={ss.sub}>
              {submitResult.isQueued
                ? 'Entry queued. Will push to Tally when desktop reconnects.'
                : 'Receipt pushed to Tally successfully.'}
            </Text>
            {submitResult.numberingPolicy === 'tallydekho_series' && submitResult.voucherNumber && (
              <View style={[ss.refBadge, { backgroundColor: '#F0FDF4', borderColor: '#22C55E44' }]}>
                <Text style={ss.refLabel}>Voucher No.</Text>
                <Text style={[ss.refVal, { color: '#166534' }]}>{submitResult.voucherNumber}</Text>
              </View>
            )}
            {!!submitResult.tdkRef && (
              <View style={ss.refBadge}>
                <Text style={ss.refLabel}>Reference No.</Text>
                <Text style={ss.refVal}>{submitResult.tdkRef}</Text>
              </View>
            )}
            <TouchableOpacity
              style={ss.previewBtn}
              activeOpacity={0.85}
              onPress={() => {
                if (!submitResult.tdkRef) return;
                router.replace(`/voucher/receipt-preview?tdkRef=${encodeURIComponent(submitResult.tdkRef)}` as any);
              }}
            >
              <Ionicons name="eye-outline" size={18} color={COLORS.brandPrimary} />
              <Text style={ss.previewBtnTxt}>Preview</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ss.closeBtn} activeOpacity={0.85} onPress={() => { setShowSuccess(false); router.back(); }}>
              <Text style={ss.closeBtnTxt}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Date pickers */}
      <DatePickerModal
        visible={showDatePicker}
        value={date}
        minDate={fyStart}
        maxDate={new Date().toISOString().slice(0, 10)}
        onSelect={(d) => { setDate(d); setShowDatePicker(false); }}
        onClose={() => setShowDatePicker(false)}
      />
      <DatePickerModal
        visible={showInstrumentDatePicker}
        value={instrumentDate || todayStr()}
        maxDate={new Date().toISOString().slice(0, 10)}
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
  allocFooter: { padding: 14, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg, gap: 6, marginTop: 2 },
  allocRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  allocLbl: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '600' },
  allocVal: { fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, fontWeight: '800' },
  leftoverPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: COLORS.brandPrimary + '55', borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: COLORS.brandPrimary + '11' },
  leftoverPillTxt: { fontSize: 11, fontWeight: '800', color: COLORS.brandPrimary },
  errTxt: { fontSize: 12, color: COLORS.negative, fontWeight: '600', marginTop: 2 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btnSecondary: { flex: 1, paddingVertical: 14, borderRadius: RADIUS.lg, borderWidth: 1.5, borderColor: COLORS.borderStrong, alignItems: 'center' },
  btnSecTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  btnPrimary: { flex: 2, paddingVertical: 14, borderRadius: RADIUS.lg, backgroundColor: COLORS.brandPrimary, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
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
  overlay2: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24, zIndex: 10 },
  card: { width: '100%', maxWidth: 400, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: 24, alignItems: 'center', gap: 12 },
  iconWrap: { marginBottom: 4 },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  sub: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, textAlign: 'center' },
  refBadge: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, backgroundColor: COLORS.pageBg, minWidth: 220, alignItems: 'center' },
  refLabel: { fontSize: 11, color: COLORS.textTertiary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  refVal: { fontSize: TYPOGRAPHY.md, color: COLORS.textPrimary, fontWeight: '800', marginTop: 3 },
  previewBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 20, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.brandPrimary, minWidth: 220 },
  previewBtnTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.brandPrimary, fontWeight: '800' },
  closeBtn: { paddingVertical: 10, paddingHorizontal: 16 },
  closeBtnTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary, fontWeight: '700' },
});
