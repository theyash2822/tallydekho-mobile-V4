/**
 * Create Journal Voucher — rewrite (2026-07-14)
 * Single Dr+Cr pair. Optional Depreciation-on-Asset (Direct / write-down):
 *   Dr Depreciation expense · Cr Asset ledger
 *   Base WDV = asset FY closing (editable) × IT rate%
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
import BrandSwitch from '../../src/components/forms/BrandSwitch';
import DatePickerModal from '../../src/components/forms/DatePickerModal';
import BottomSheetSearch, { BSSOption } from '../../src/components/forms/BottomSheetSearch';
import { useAuth } from '../../src/context/AuthContext';
import {
  createJournalVoucher, getLedgers,
} from '../../src/services/api';
import { useNumberingPolicy } from '../../src/hooks/useNumberingPolicy';
import { useRbasCreate } from '../../src/hooks/useRbasCreate';
import { shareVoucherPdfByRef } from '../../src/utils/voucherPdf';
import { useTranslation } from 'react-i18next';
import {
  indiaIncomeTaxDepreciationRates,
  IndiaDepreciationRate,
} from '../../src/constants/indiaDepreciationRates';
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
const fmtINR = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export default function CreateJournalVoucher() {
  const allowed = useRequireCapability('journal.create');
  const { t } = useTranslation();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const narrationY = useRef(0);
  const { company, isPaired, selectedFY } = useAuth();
  const fyStart = selectedFY?.startDate || `${new Date().getFullYear()}-04-01`;

  const {entryMode, entryType, setEntryType, scopeParties, assertCanCreate} = useRbasCreate();
  const { numberingPolicy } = useNumberingPolicy(company?.guid);

  const [date, setDate] = useState(todayStr());
  const [showDatePicker, setShowDatePicker] = useState(false);
  useEffect(() => {
    if (entryType === 'regular') setDate(todayStr());
  }, [entryType]);

  const [ledgers, setLedgers] = useState<BSSOption[]>([]);
  const [drLedger, setDrLedger] = useState('');
  const [crLedger, setCrLedger] = useState('');
  const [amount, setAmount] = useState('');
  const [amountManual, setAmountManual] = useState(false);
  const [narration, setNarration] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    tdkRef: string; isQueued: boolean; voucherNumber?: string; numberingPolicy?: string;
  } | null>(null);
  const [sharePdfLoading, setSharePdfLoading] = useState(false);

  // Depreciation mode (Direct: Dr expense · Cr asset)
  const [deprOn, setDeprOn] = useState(false);
  const [wdvBase, setWdvBase] = useState('');
  const [assetClosingFetched, setAssetClosingFetched] = useState<number | null>(null);
  const [rateBlock, setRateBlock] = useState<IndiaDepreciationRate | null>(null);
  const [ratePercent, setRatePercent] = useState('');
  const [showRatePicker, setShowRatePicker] = useState(false);
  const [rateSearch, setRateSearch] = useState('');

  const loadLedgers = useCallback(async () => {
    if (!company?.guid) return;
    try {
      // Full company list for both By and To (Option A). High limit so picker isn't truncated.
      const fyParams = selectedFY?.startDate && selectedFY?.endDate
        ? { from: selectedFY.startDate, to: selectedFY.endDate }
        : {};
      const res: any = await getLedgers(company.guid, { limit: '2000', page: '1', ...fyParams });
      const raw = res?.data ?? res?.rows ?? (Array.isArray(res) ? res : []);
      const list = scopeParties(Array.isArray(raw) ? raw : []).map((l: any) => {
        const close = parseFloat(l.closing_balance);
        const hasClose = Number.isFinite(close);
        const balHint = hasClose
          ? `${fmtINR(Math.abs(close))} ${l.balance_type || ''}`.trim()
          : null;
        const parent = l.parent || l.group || '';
        return {
          label: l.name,
          value: l.name,
          subtitle: [parent, balHint].filter(Boolean).join(' · ') || undefined,
          data: l,
        };
      }).sort((a: BSSOption, b: BSSOption) => a.label.localeCompare(b.label));
      setLedgers(list);
    } catch {
      setLedgers([]);
    }
  }, [company?.guid, selectedFY?.startDate, selectedFY?.endDate, scopeParties]);

  useEffect(() => { loadLedgers(); }, [loadLedgers]);

  // Recalc amount from WDV × rate when not manually overridden
  useEffect(() => {
    if (!deprOn || amountManual) return;
    const base = parseFloat(wdvBase) || 0;
    const rate = parseFloat(ratePercent) || 0;
    if (base > 0 && rate > 0) {
      const calc = Math.round((base * rate) / 100 * 100) / 100;
      setAmount(String(calc));
    }
  }, [deprOn, wdvBase, ratePercent, amountManual]);

  /** Credit picker in depr mode = Asset → fill editable Base from FY closing. */
  const selectCrLedger = (opt: BSSOption) => {
    setCrLedger(opt.value);
    if (!deprOn) return;
    const raw = opt.data?.closing_balance;
    const close = parseFloat(raw);
    if (Number.isFinite(close) && Math.abs(close) > 0) {
      const abs = Math.abs(close);
      setAssetClosingFetched(abs);
      setWdvBase(String(abs));
      setAmountManual(false);
    } else {
      setAssetClosingFetched(null);
      setWdvBase('');
      Toast.show({
        type: 'info',
        text1: 'No closing balance',
        text2: 'Enter WDV / base amount manually.',
      });
    }
  };

  const resetDeprFields = () => {
    setWdvBase('');
    setAssetClosingFetched(null);
    setRateBlock(null);
    setRatePercent('');
    setAmountManual(false);
  };

  const filteredRates = useMemo(() => {
    const q = rateSearch.trim().toLowerCase();
    if (!q) return indiaIncomeTaxDepreciationRates;
    return indiaIncomeTaxDepreciationRates.filter(
      (r) =>
        r.displayName.toLowerCase().includes(q)
        || r.description.toLowerCase().includes(q)
        || String(r.ratePercent).includes(q),
    );
  }, [rateSearch]);

  const canSubmit = useMemo(() => {
    if (deprOn) {
      if (!crLedger) return 'Select Asset (Credit) ledger';
      if (!drLedger) return 'Select Depreciation expense (Debit) ledger';
      if (!(parseFloat(wdvBase) > 0)) return 'Enter WDV / base amount';
      if (!(parseFloat(ratePercent) > 0)) return 'Select or enter depreciation %';
      if (!(parseFloat(amount) > 0)) return 'Enter amount';
      return null;
    }
    if (!drLedger) return 'Select Debit (By) ledger';
    if (!crLedger) return 'Select Credit (To) ledger';
    if (!(parseFloat(amount) > 0)) return 'Enter amount';
    return null;
  }, [drLedger, crLedger, amount, deprOn, wdvBase, ratePercent]);

  const handleSubmit = async () => {
    if (canSubmit) { Alert.alert(t('voucher.required'), canSubmit); return; }
    if (!assertCanCreate('journal.create')) return;
    setSubmitting(true);
    try {
      const payload: any = {
        companyGuid: company?.guid,
        companyName: company?.name,
        date: dmyToISO(date),
        amount: parseFloat(amount) || 0,
        drLedger,
        crLedger,
        entryType,
        numbering_policy: numberingPolicy,
        narration: narration || undefined,
      };
      if (deprOn) {
        payload.depreciationMeta = {
          method: 'direct_write_down',
          baseWdv: parseFloat(wdvBase) || 0,
          ratePercent: parseFloat(ratePercent) || 0,
          assetLedger: crLedger,
          expenseLedger: drLedger,
          assetClosingFetched,
          assetBlock: rateBlock?.assetBlock || null,
          displayName: rateBlock?.displayName || null,
        };
      }
      const res: any = await createJournalVoucher(payload);
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

  const selectRate = (r: IndiaDepreciationRate) => {
    setRateBlock(r);
    setRatePercent(String(r.ratePercent));
    setAmountManual(false);
    setShowRatePicker(false);
    setRateSearch('');
  };

  const swapLedgers = () => {
    if (deprOn) return; // Direct depr: Cr must stay the asset
    if (!drLedger && !crLedger) return;
    setDrLedger(crLedger);
    setCrLedger(drLedger);
  };

  if (!allowed) return null;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.hdr}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.hdrTitle}>{t('voucher.journalTitle')}</Text>
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
          {/* ── Journal No. + Date (mirrors Receipt / Payment layout) ───── */}
          <View style={s.section}>
            <View style={[s.fieldBlock, { padding: SPACING.md }]}>
              <View style={s.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={s.fLabel}>{t('voucher.journalNo')}</Text>
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

          {/* Depreciation toggle — Direct write-down method */}
          <View style={s.card}>
            <TouchableOpacity
              style={s.payNowToggleRow}
              onPress={() => {
                const v = !deprOn;
                setDeprOn(v);
                if (!v) resetDeprFields();
                else setAmountManual(false);
              }}
              activeOpacity={0.8}
            >
              <View style={s.payNowLeft}>
                <View style={[s.payNowIcon, { backgroundColor: deprOn ? COLORS.positiveBg : COLORS.pageBg }]}>
                  <Ionicons name="trending-down-outline" size={18} color={deprOn ? COLORS.positive : COLORS.textSecondary} />
                </View>
                <View style={{ flex: 1, flexShrink: 1 }}>
                  <Text style={s.payNowTitle}>Depreciation on Asset</Text>
                  <Text style={s.payNowSub}>Dr expense · Cr Asset · % of asset closing (WDV)</Text>
                </View>
              </View>
              <BrandSwitch
                value={deprOn}
                onValueChange={(v) => {
                  setDeprOn(v);
                  if (!v) resetDeprFields();
                  else setAmountManual(false);
                }}
              />
            </TouchableOpacity>
          </View>

          {/* Dr / Cr summary */}
          <View style={s.drCrRow}>
            <View style={[s.drCrBox, { borderColor: COLORS.negative + '60', backgroundColor: COLORS.negativeBg }]}>
              <Text style={[s.drCrLabel, { color: COLORS.negative }]}>Dr (By)</Text>
              <Text style={[s.drCrValue, { color: COLORS.negative }]}>{amount ? fmtINR(parseFloat(amount) || 0) : '—'}</Text>
              <Text style={s.drCrLedger} numberOfLines={2}>{drLedger || (deprOn ? 'Depreciation expense' : 'Debit ledger')}</Text>
            </View>
            <View style={s.arrowBox}>
              <TouchableOpacity
                onPress={swapLedgers}
                disabled={deprOn || (!drLedger && !crLedger)}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={{ opacity: (deprOn || (!drLedger && !crLedger)) ? 0.35 : 1 }}
                accessibilityLabel="Swap debit and credit ledgers"
              >
                <Ionicons name="swap-horizontal" size={20} color={COLORS.brandPrimary} />
              </TouchableOpacity>
            </View>
            <View style={[s.drCrBox, { borderColor: COLORS.positive + '60', backgroundColor: COLORS.positiveBg }]}>
              <Text style={[s.drCrLabel, { color: COLORS.positive }]}>Cr (To)</Text>
              <Text style={[s.drCrValue, { color: COLORS.positive }]}>{amount ? fmtINR(parseFloat(amount) || 0) : '—'}</Text>
              <Text style={s.drCrLedger} numberOfLines={2}>{crLedger || (deprOn ? 'Asset ledger' : 'Credit ledger')}</Text>
            </View>
          </View>

          {/* Ledger entries FIRST — then depreciation calc (when on) */}
          <View style={s.card}>
            <Text style={s.sectionTitle}>Ledger entries</Text>
            {deprOn ? (
              <>
                <BottomSheetSearch
                  label="Credit — Asset (write-down)"
                  required
                  placeholder="e.g. Rolls Royal / Plant & Machinery"
                  value={crLedger}
                  options={ledgers}
                  onSelect={selectCrLedger}
                  onClear={() => { setCrLedger(''); setWdvBase(''); setAssetClosingFetched(null); }}
                  sheetTitle="Select Asset Ledger"
                  searchPlaceholder="Search asset ledger…"
                  icon="add-circle-outline"
                />
                <View style={{ height: 10 }} />
                <BottomSheetSearch
                  label="Debit — Depreciation expense"
                  required
                  placeholder="e.g. Depreciation"
                  value={drLedger}
                  options={ledgers}
                  onSelect={(opt) => setDrLedger(opt.value)}
                  onClear={() => setDrLedger('')}
                  sheetTitle="Select Depreciation Expense"
                  searchPlaceholder="Search expense ledger…"
                  icon="remove-circle-outline"
                />
              </>
            ) : (
              <>
                <BottomSheetSearch
                  label="Debit ledger (By)"
                  required
                  placeholder="Search ledger"
                  value={drLedger}
                  options={ledgers}
                  onSelect={(opt) => setDrLedger(opt.value)}
                  onClear={() => setDrLedger('')}
                  sheetTitle="Select Debit Ledger"
                  searchPlaceholder="Search ledger…"
                  icon="remove-circle-outline"
                />
                <View style={{ height: 10 }} />
                <BottomSheetSearch
                  label="Credit ledger (To)"
                  required
                  placeholder="Search ledger"
                  value={crLedger}
                  options={ledgers}
                  onSelect={(opt) => setCrLedger(opt.value)}
                  onClear={() => setCrLedger('')}
                  sheetTitle="Select Credit Ledger"
                  searchPlaceholder="Search ledger…"
                  icon="add-circle-outline"
                />
              </>
            )}
          </View>

          {deprOn && (
            <View style={s.card}>
              <Text style={s.sectionTitle}>Depreciation calc</Text>
              <Text style={s.hint}>Base fills from the Asset closing above — you can still edit it.</Text>

              <Text style={[s.fieldLbl, { marginTop: 8 }]}>Base (WDV) <Text style={s.req}>*</Text></Text>
              <View style={s.inputWrap}>
                <Text style={s.rupee}>₹</Text>
                <TextInput
                  style={s.input}
                  placeholder="From asset closing / enter manually"
                  placeholderTextColor={COLORS.textTertiary}
                  value={wdvBase}
                  onChangeText={(t) => { setWdvBase(t); setAmountManual(false); }}
                  keyboardType="numeric"
                />
              </View>
              {assetClosingFetched != null && (
                <Text style={s.calcHint}>
                  From ledger closing: {fmtINR(assetClosingFetched)} (editable)
                </Text>
              )}

              <Text style={[s.fieldLbl, { marginTop: 12 }]}>Asset block / rate <Text style={s.req}>*</Text></Text>
              <TouchableOpacity style={s.pickerBtn} onPress={() => setShowRatePicker(true)} activeOpacity={0.7}>
                <Ionicons name="list-outline" size={16} color={COLORS.brandPrimary} />
                <Text style={[s.pickerTxt, !rateBlock && { color: COLORS.textTertiary }]} numberOfLines={2}>
                  {rateBlock ? `${rateBlock.displayName} (${rateBlock.ratePercent}%)` : 'Select Income-tax block'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={COLORS.textTertiary} />
              </TouchableOpacity>

              <Text style={[s.fieldLbl, { marginTop: 12 }]}>Rate % <Text style={s.req}>*</Text></Text>
              <View style={s.inputWrap}>
                <TextInput
                  style={s.input}
                  placeholder="e.g. 15"
                  placeholderTextColor={COLORS.textTertiary}
                  value={ratePercent}
                  onChangeText={(t) => { setRatePercent(t); setAmountManual(false); }}
                  keyboardType="numeric"
                />
                <Text style={s.rupee}>%</Text>
              </View>
              {(parseFloat(wdvBase) > 0 && parseFloat(ratePercent) > 0) && (
                <Text style={s.calcHint}>
                  {fmtINR(parseFloat(wdvBase))} × {ratePercent}% = {fmtINR((parseFloat(wdvBase) * parseFloat(ratePercent)) / 100)}
                </Text>
              )}
            </View>
          )}

          {/* Amount */}
          <View style={s.card}>
            <Text style={s.sectionTitle}>Amount</Text>
            <View style={s.inputWrap}>
              <Text style={s.rupee}>₹</Text>
              <TextInput
                style={s.input}
                placeholder="Enter amount"
                placeholderTextColor={COLORS.textTertiary}
                value={amount}
                onChangeText={(t) => { setAmount(t); if (deprOn) setAmountManual(true); }}
                keyboardType="numeric"
              />
            </View>
            {deprOn && amountManual && (
              <TouchableOpacity onPress={() => setAmountManual(false)} style={{ marginTop: 8 }}>
                <Text style={s.linkTxt}>Recalculate from WDV × %</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Narration */}
          <View
            style={s.card}
            onLayout={(e) => { narrationY.current = e.nativeEvent.layout.y; }}
          >
            <Text style={s.sectionTitle}>Narration</Text>
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

          <TouchableOpacity
            style={[s.btnPrimary, (!!canSubmit || submitting) && { opacity: 0.6 }]}
            onPress={handleSubmit}
            activeOpacity={0.8}
            disabled={!!canSubmit || submitting}
          >
            {submitting
              ? <ActivityIndicator size="small" color={COLORS.white} />
              : <Ionicons name="send" size={16} color={COLORS.white} />}
            <Text style={s.btnPriTxt}>{submitting ? t('voucher.submitting') : t('voucher.submitJournal')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <DatePickerModal
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        value={date}
        onSelect={(d) => { setDate(d); setShowDatePicker(false); }}
        minDate={fyStart}
      />

      {/* Rate picker modal */}
      <Modal visible={showRatePicker} animationType="slide" onRequestClose={() => setShowRatePicker(false)}>
        <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
          <View style={s.hdr}>
            <TouchableOpacity onPress={() => setShowRatePicker(false)} style={s.back}>
              <Ionicons name="close" size={22} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={s.hdrTitle}>Depreciation rates</Text>
            <View style={{ width: 36 }} />
          </View>
          <View style={s.search}>
            <Ionicons name="search" size={16} color={COLORS.textTertiary} />
            <TextInput
              style={s.searchIn}
              placeholder="Search block or %"
              placeholderTextColor={COLORS.textTertiary}
              value={rateSearch}
              onChangeText={setRateSearch}
              autoFocus
            />
          </View>
          <ScrollView contentContainerStyle={{ padding: SPACING.md, gap: 8, paddingBottom: 40 }}>
            {filteredRates.map((r) => (
              <TouchableOpacity
                key={r.assetBlock}
                style={[s.rateRow, rateBlock?.assetBlock === r.assetBlock && s.rateRowActive]}
                onPress={() => selectRate(r)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.rateName}>{r.displayName}</Text>
                  <Text style={s.rateDesc} numberOfLines={2}>{r.description}</Text>
                </View>
                <Text style={s.ratePct}>{r.ratePercent}%</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {showSuccess && submitResult && (
        <View style={ss.overlay}>
          <View style={ss.card}>
            <View style={ss.iconWrap}>
              <Ionicons
                name={submitResult.isQueued ? 'time-outline' : 'checkmark-circle'}
                size={56}
                color={submitResult.isQueued ? COLORS.warning : COLORS.positive}
              />
            </View>
            <Text style={ss.title}>{submitResult.isQueued ? t('voucher.journalQueued') : t('voucher.journalSubmitted')}</Text>
            <Text style={ss.sub}>
              {submitResult.isQueued
                ? 'Entry queued. Will push to Tally when desktop reconnects.'
                : t('voucher.journalPushed')}
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
                router.replace(`/voucher/journal-preview?tdkRef=${encodeURIComponent(submitResult.tdkRef)}` as any);
              }}
            >
              <Ionicons name="eye-outline" size={18} color={COLORS.brandPrimary} />
              <Text style={ss.previewBtnTxt}>Preview</Text>
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
                    documentType: 'journal_voucher',
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
              <Text style={ss.pdfBtnTxt}>{sharePdfLoading ? 'PDF is creating...' : 'Share PDF'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ss.closeBtn} activeOpacity={0.85} onPress={() => { setShowSuccess(false); router.back(); }}>
              <Text style={ss.closeBtnTxt}>Close</Text>
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
  },
  autoBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault,
    borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, minHeight: 48,
  },
  autoTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '600' },
  card: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault,
    padding: SPACING.md, gap: 8,
  },
  payNowToggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 4, gap: 10,
  },
  payNowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  payNowIcon: {
    width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  payNowTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  payNowSub: { fontSize: 12, color: COLORS.textTertiary, marginTop: 2, lineHeight: 16 },
  hint: { fontSize: 12, color: COLORS.textTertiary, lineHeight: 16 },
  sectionTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  fieldLbl: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary, textTransform: 'uppercase' },
  req: { color: COLORS.negative },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: COLORS.borderDefault,
    borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: COLORS.pageBg,
  },
  input: { flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  rupee: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textSecondary },
  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: COLORS.borderDefault,
    borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: COLORS.pageBg,
  },
  pickerTxt: { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  calcHint: { fontSize: 12, color: COLORS.brandPrimary, fontWeight: '600', marginTop: 4 },
  linkTxt: { fontSize: 13, color: COLORS.brandPrimary, fontWeight: '600' },
  drCrRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  drCrBox: { flex: 1, borderRadius: RADIUS.lg, borderWidth: 1.5, padding: 14, alignItems: 'center', gap: 4 },
  drCrLabel: { fontSize: TYPOGRAPHY.xs, fontWeight: '800', letterSpacing: 1 },
  drCrValue: { fontSize: TYPOGRAPHY.lg, fontWeight: '800' },
  drCrLedger: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontWeight: '500', textAlign: 'center' },
  arrowBox: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.cardBg, borderWidth: 1,
    borderColor: COLORS.borderDefault, alignItems: 'center', justifyContent: 'center',
  },
  textarea: {
    borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, padding: 12,
    fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, backgroundColor: COLORS.pageBg, minHeight: 88,
  },
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.lg, paddingVertical: 16,
  },
  btnPriTxt: { color: COLORS.white, fontSize: TYPOGRAPHY.base, fontWeight: '700' },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: SPACING.md, marginTop: SPACING.sm,
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  searchIn: { flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  rateRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md, padding: 14, borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  rateRowActive: { borderColor: COLORS.brandPrimary, backgroundColor: COLORS.brandPrimary + '10' },
  rateName: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  rateDesc: { fontSize: 11, color: COLORS.textTertiary, marginTop: 2, lineHeight: 15 },
  ratePct: { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.brandPrimary },
});

const ss = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 50,
  },
  card: {
    width: '100%', backgroundColor: COLORS.cardBg, borderRadius: 20, padding: 24, alignItems: 'center', gap: 12,
  },
  iconWrap: { marginBottom: 4 },
  title: { fontSize: TYPOGRAPHY.lg, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center' },
  sub: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  refBadge: {
    width: '100%', borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md,
    padding: 12, backgroundColor: COLORS.pageBg, alignItems: 'center', gap: 4,
  },
  refLabel: { fontSize: 11, color: COLORS.textTertiary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  refVal: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  previewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'center',
    paddingVertical: 14, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.brandPrimary,
  },
  previewBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.brandPrimary },
  pdfBtn: { flexDirection: 'row', gap: 8, backgroundColor: COLORS.brandPrimary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 20, width: '100%', justifyContent: 'center', alignItems: 'center' },
  pdfBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
  closeBtn: { paddingVertical: 10 },
  closeBtnTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary, fontWeight: '700' },
});
