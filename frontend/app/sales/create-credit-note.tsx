import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { ErrorBanner } from '../../src/components/ApiStateViews';
import BottomSheetSearch, { BSSOption } from '../../src/components/forms/BottomSheetSearch';
import DatePickerModal from '../../src/components/forms/DatePickerModal';
import RegularOptionalToggle, { EntryType } from '../../src/components/forms/RegularOptionalToggle';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { useSettings } from '../../src/context/SettingsContext';
import { useApiData } from '../../src/hooks/useApiData';
import { useNumberingPolicy } from '../../src/hooks/useNumberingPolicy';
import {
  createCreditNote,
  getParties,
  getSalesInvoiceCreditNoteContext,
  getSalesInvoices,
  getSalesLedgerAccounts,
  getTaxLedgers,
  getWarehouses,
} from '../../src/services/api';

type InvoiceChoice = {
  id: string;
  voucherNumber: string;
  date: string;
  amount: number;
  party: string;
  guid?: string;
  billRefName?: string;
  tdkRef?: string;
};

type ReturnItem = {
  id: string;
  lineId?: string;
  itemName: string;
  soldQty: number;
  previouslyReturnedQty: number;
  remainingQty: number;
  selected: boolean;
  returnQty: string;
  unit: string;
  rate: number;
  salesLedger: string;
  godown: string;
  taxRate?: number;
};

type ReturnTax = {
  id: string;
  ledger: string;
  rate: string;
  amount: string;
  manualAmount: boolean;
};

type CreditNoteContext = {
  invoice: InvoiceChoice;
  items: ReturnItem[];
  taxes: ReturnTax[];
  salesLedger: string;
  salesLedgerCandidates: string[];
};

type SubmitResult = {
  tdkRef: string;
  voucherNumber?: string;
  isQueued: boolean;
};

const num = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const first = (...values: any[]) => values.find(v => v !== undefined && v !== null && v !== '');

const todayDMY = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
};

const dmyToISO = (value: string) => {
  const [dd, mm, yy] = value.split('/');
  if (!dd || !mm || !yy) return value;
  const year = Number(yy) < 100 ? 2000 + Number(yy) : Number(yy);
  return `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
};

const isoToDMY = (value: string) => {
  if (!value || !value.includes('-')) return value || '';
  const [yyyy, mm, dd] = value.slice(0, 10).split('-');
  return `${dd}/${mm}/${yyyy.slice(-2)}`;
};

const formatQty = (value: number) => Number(value.toFixed(4)).toString();
const formatMoney = (value: number) => `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

function normalizeInvoices(raw: any): InvoiceChoice[] {
  const rows = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw?.invoices) ? raw.invoices : Array.isArray(raw) ? raw : [];
  return rows
    .map((row: any) => {
      const voucherNumber = String(first(row.voucher_number, row.voucherNumber, row.number, '') || '');
      const id = String(first(row.guid, row.id, row.voucher_guid, voucherNumber, '') || '');
      return {
        id,
        guid: first(row.guid, row.voucher_guid),
        voucherNumber,
        date: String(first(row.date, row.voucher_date, '') || ''),
        amount: Math.abs(num(first(row.party_amount, row.amount, row.total_amount))),
        party: String(first(row.party_name, row.partyLedger, row.party, '') || ''),
      };
    })
    .filter((row: InvoiceChoice) => !!row.id && !!row.voucherNumber);
}

function normalizeContext(raw: any, selected: InvoiceChoice): CreditNoteContext {
  const body = raw?.data ?? raw ?? {};
  const invoiceRaw = body.invoice ?? body.originalInvoice ?? body.original_invoice ?? {};
  const linked = body.linkedInvoice ?? body.linked_invoice ?? {};
  const invoice: InvoiceChoice = {
    ...selected,
    id: String(first(invoiceRaw.guid, invoiceRaw.id, body.invoiceId, selected.id)),
    guid: first(invoiceRaw.guid, invoiceRaw.voucher_guid, linked.invoiceGuid, selected.guid),
    voucherNumber: String(first(invoiceRaw.voucherNumber, invoiceRaw.voucher_number, body.invoiceNumber, linked.voucherNumber, selected.voucherNumber)),
    date: String(first(invoiceRaw.date, invoiceRaw.voucher_date, selected.date)),
    amount: Math.abs(num(first(invoiceRaw.amount, invoiceRaw.totalAmount, selected.amount))),
    party: String(first(invoiceRaw.partyName, invoiceRaw.partyLedger, invoiceRaw.party_name, invoiceRaw.party, linked.partyLedger, selected.party)),
    billRefName: String(first(invoiceRaw.billRefName, invoiceRaw.bill_ref_name, linked.billRefName, linked.bill_ref_name, selected.billRefName, '') || '') || undefined,
    tdkRef: String(first(invoiceRaw.tdkRef, invoiceRaw.tdk_reference_no, linked.tdkRef, linked.tdk_ref, selected.tdkRef, '') || '') || undefined,
  };

  // Backend context exposes defaultSalesLedger / salesLedgerCandidates — not body.salesLedger.
  const defaultSalesLedger = String(first(
    body.defaultSalesLedger,
    body.default_sales_ledger,
    Array.isArray(body.salesLedgerCandidates) ? body.salesLedgerCandidates[0]?.ledgerName : '',
    Array.isArray(body.invoiceSalesLedgers) ? body.invoiceSalesLedgers[0]?.ledgerName : '',
    body.salesLedger,
    body.sales_ledger,
    ''
  ) || '');

  const sourceItems = first(
    body.items,
    body.inventoryItems,
    body.inventory_items,
    invoiceRaw.items,
    invoiceRaw.inventory_items,
  );
  const items = (Array.isArray(sourceItems) ? sourceItems : []).map((row: any, index: number): ReturnItem => {
    const soldQty = Math.abs(num(first(row.soldQty, row.sold_qty, row.originalQty, row.original_qty, row.billedQty, row.billed_qty, row.actualQty, row.actual_qty, row.qty)));
    const previouslyReturnedQty = Math.abs(num(first(row.previouslyReturnedQty, row.previously_returned_qty, row.returnedQty, row.returned_qty, row.cumulativeReturnedQty, row.cumulative_returned_qty)));
    const explicitRemaining = first(row.remainingQty, row.remaining_qty, row.returnableQty, row.returnable_qty, row.availableQty, row.available_qty);
    const remainingQty = explicitRemaining === undefined
      ? Math.max(0, soldQty - previouslyReturnedQty)
      : Math.max(0, num(explicitRemaining));
    return {
      id: String(first(row.id, row.lineId, row.line_id, row.inventoryEntryId, `${index}-${first(row.itemName, row.stock_item_name, row.name, 'item')}`)),
      lineId: first(row.lineId, row.line_id, row.inventoryEntryId, row.inventory_entry_id),
      itemName: String(first(row.itemName, row.item_name, row.stockItem, row.stock_item_name, row.name, '') || ''),
      soldQty,
      previouslyReturnedQty,
      remainingQty,
      selected: false,
      returnQty: '',
      unit: String(first(row.unit, row.baseUnit, row.base_unit, '') || ''),
      rate: Math.abs(num(first(row.rate, row.originalRate, row.original_rate))),
      salesLedger: String(first(row.salesLedger, row.sales_ledger, row.ledger, defaultSalesLedger, '') || ''),
      godown: String(first(row.godown, row.godownName, row.godown_name, row.warehouse, row.warehouseName, 'Main Location') || 'Main Location'),
      taxRate: num(first(row.taxRate, row.tax_rate, row.gstRate, row.gst_rate)) || undefined,
    };
  }).filter((item: ReturnItem) => !!item.itemName);

  const sourceTaxes = first(
    body.taxes,
    body.taxEntries,
    body.tax_entries,
    body.taxLines,
    body.tax_lines,
    body.gst?.taxes,
    invoiceRaw.taxes,
  );
  const taxes = (Array.isArray(sourceTaxes) ? sourceTaxes : []).map((row: any, index: number): ReturnTax => {
    const rate = num(first(row.rate, row.taxRate, row.tax_rate, row.percentage));
    const contextAmount = Math.abs(num(first(row.returnAmount, row.return_amount, row.amount, row.taxAmount, row.tax_amount)));
    return {
      id: String(first(row.id, row.ledger, row.ledgerName, row.ledger_name, index)),
      ledger: String(first(row.ledger, row.ledgerName, row.ledger_name, row.name, '') || ''),
      rate: String(rate || ''),
      amount: contextAmount ? String(contextAmount) : '',
      manualAmount: rate <= 0 && contextAmount > 0,
    };
  }).filter((tax: ReturnTax) => !!tax.ledger);

  const candidateRows = (Array.isArray(body.salesLedgerCandidates) && body.salesLedgerCandidates.length > 0)
    ? body.salesLedgerCandidates
    : (Array.isArray(body.invoiceSalesLedgers) && body.invoiceSalesLedgers.length > 0)
      ? body.invoiceSalesLedgers
      : (Array.isArray(body.companySalesLedgers) ? body.companySalesLedgers : []);
  const salesLedgerCandidates = candidateRows
    .map((row: any) => String(first(row?.ledgerName, row?.ledger_name, row?.name, typeof row === 'string' ? row : '') || ''))
    .filter(Boolean);

  return {
    invoice,
    items,
    taxes,
    salesLedger: String(first(defaultSalesLedger, items[0]?.salesLedger, salesLedgerCandidates[0], '') || ''),
    salesLedgerCandidates: [...new Set([defaultSalesLedger, ...salesLedgerCandidates, ...items.map(i => i.salesLedger)].filter(Boolean))],
  };
}

export default function CreateCreditNoteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const narrationY = useRef(0);
  const { company, selectedFY, isPaired } = useAuth();
  const { formatAmount } = useSettings();
  const { numberingPolicy } = useNumberingPolicy(company?.guid);

  const fyStart = selectedFY?.startDate || `${new Date().getFullYear()}-04-01`;
  const fyEnd = selectedFY?.endDate || `${new Date().getFullYear() + 1}-03-31`;

  const [step, setStep] = useState<1 | 2>(1);
  const [entryType, setEntryType] = useState<EntryType>('regular');
  const [date, setDate] = useState(todayDMY());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [party, setParty] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceChoice | null>(null);
  const [items, setItems] = useState<ReturnItem[]>([]);
  const [taxes, setTaxes] = useState<ReturnTax[]>([]);
  const [invoiceSalesLedgers, setInvoiceSalesLedgers] = useState<string[]>([]);
  const [narration, setNarration] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);

  useEffect(() => {
    if (entryType === 'regular') setDate(todayDMY());
  }, [entryType]);

  const partiesState = useApiData<any[]>(
    () => getParties(company!.guid),
    [company?.guid],
    { enabled: !!company?.guid, transform: res => Array.isArray(res?.data) ? res.data : [] },
  );
  const salesLedgersState = useApiData<any[]>(
    () => getSalesLedgerAccounts(company!.guid),
    [company?.guid],
    { enabled: !!company?.guid, transform: res => Array.isArray(res?.data) ? res.data : [] },
  );
  const taxLedgersState = useApiData<any[]>(
    () => getTaxLedgers(company!.guid),
    [company?.guid],
    { enabled: !!company?.guid, transform: res => Array.isArray(res?.data) ? res.data : [] },
  );
  const warehousesState = useApiData<any[]>(
    () => getWarehouses(company!.guid),
    [company?.guid],
    {
      enabled: !!company?.guid,
      transform: res => Array.isArray(res?.data) ? res.data : Array.isArray(res?.warehouses) ? res.warehouses : [],
    },
  );

  const invoicesState = useApiData<InvoiceChoice[]>(
    () => getSalesInvoices(company!.guid, {
      partyName: party,
      from: fyStart,
      to: fyEnd,
      limit: '500',
    }),
    [company?.guid, party, fyStart, fyEnd],
    {
      enabled: !!company?.guid && !!party,
      transform: normalizeInvoices,
      emptyCheck: rows => rows.length === 0,
    },
  );

  const contextState = useApiData<CreditNoteContext>(
    () => getSalesInvoiceCreditNoteContext(selectedInvoice!.id, company!.guid),
    [company?.guid, selectedInvoice?.id],
    {
      enabled: !!company?.guid && !!selectedInvoice?.id,
      transform: raw => normalizeContext(raw, selectedInvoice!),
      emptyCheck: context => context.items.length === 0,
    },
  );

  useEffect(() => {
    if (!contextState.data || !selectedInvoice || contextState.data.items.length === 0) return;
    setSelectedInvoice(contextState.data.invoice);
    setItems(contextState.data.items);
    setTaxes(contextState.data.taxes);
    setInvoiceSalesLedgers(contextState.data.salesLedgerCandidates);
    setStep(2);
  }, [contextState.data]);

  const partyOptions: BSSOption[] = useMemo(() => (partiesState.data || []).map((row: any) => ({
    label: row.name,
    value: row.name,
    subtitle: row.gstin ? `GSTIN: ${row.gstin}` : undefined,
    data: row,
  })).filter(option => !!option.value), [partiesState.data]);

  const invoiceOptions: BSSOption[] = useMemo(() => (invoicesState.data || []).map(invoice => ({
    label: `#${invoice.voucherNumber}`,
    value: invoice.id,
    subtitle: [
      invoice.date ? isoToDMY(invoice.date) : '',
      invoice.amount ? formatAmount(invoice.amount) : '',
    ].filter(Boolean).join(' · '),
    data: invoice,
  })), [invoicesState.data, formatAmount]);

  const salesLedgerOptions: BSSOption[] = useMemo(() => {
    const names = new Set<string>();
    // Prefer ledgers the linked invoice actually posted to — backend rejects others.
    invoiceSalesLedgers.forEach(name => name && names.add(name));
    items.forEach(item => item.salesLedger && names.add(item.salesLedger));
    if (names.size === 0) {
      (salesLedgersState.data || []).forEach((row: any) => row.name && names.add(row.name));
    }
    return [...names].map(name => ({ label: name, value: name }));
  }, [salesLedgersState.data, items, invoiceSalesLedgers]);

  const warehouseOptions: BSSOption[] = useMemo(() => {
    const names = new Set<string>();
    (warehousesState.data || []).forEach((row: any) => {
      const name = first(row.name, row.godown_name);
      if (name) names.add(String(name));
    });
    items.forEach(item => item.godown && names.add(item.godown));
    return [...names].map(name => ({ label: name, value: name }));
  }, [warehousesState.data, items]);

  const taxLedgerOptions: BSSOption[] = useMemo(() => {
    const names = new Set<string>();
    (taxLedgersState.data || []).forEach((row: any) => row.name && names.add(row.name));
    taxes.forEach(tax => tax.ledger && names.add(tax.ledger));
    return [...names].map(name => ({ label: name, value: name }));
  }, [taxLedgersState.data, taxes]);

  const selectedItems = useMemo(() => items.filter(item => item.selected), [items]);
  const subtotal = useMemo(() => selectedItems.reduce(
    (sum, item) => sum + (num(item.returnQty) * item.rate),
    0,
  ), [selectedItems]);
  const taxAmounts = useMemo(() => taxes.map(tax => tax.manualAmount
    ? Math.max(0, num(tax.amount))
    : subtotal * Math.max(0, num(tax.rate)) / 100
  ), [taxes, subtotal]);
  const taxTotal = taxAmounts.reduce((sum, amount) => sum + amount, 0);
  const totalAmount = subtotal + taxTotal;

  const clearInvoice = useCallback(() => {
    setSelectedInvoice(null);
    setItems([]);
    setTaxes([]);
    setInvoiceSalesLedgers([]);
    setStep(1);
  }, []);

  const selectParty = useCallback((option: BSSOption) => {
    if (option.value !== party) clearInvoice();
    setParty(option.value);
  }, [party, clearInvoice]);

  const updateItem = useCallback((id: string, changes: Partial<ReturnItem>) => {
    setItems(current => current.map(item => item.id === id ? { ...item, ...changes } : item));
  }, []);

  const toggleItem = useCallback((id: string) => {
    setItems(current => current.map(item => item.id === id
      ? { ...item, selected: !item.selected, returnQty: item.selected ? '' : item.returnQty }
      : item
    ));
  }, []);

  const updateReturnQty = useCallback((item: ReturnItem, value: string) => {
    const sanitized = value.replace(/[^0-9.]/g, '');
    const parsed = num(sanitized);
    const capped = parsed > item.remainingQty ? formatQty(item.remainingQty) : sanitized;
    updateItem(item.id, { returnQty: capped, selected: parsed > 0 ? true : item.selected });
  }, [updateItem]);

  const updateTax = useCallback((id: string, changes: Partial<ReturnTax>) => {
    setTaxes(current => current.map(tax => tax.id === id ? { ...tax, ...changes } : tax));
  }, []);

  const stepOneError = useMemo(() => {
    if (!party) return 'Select a party';
    if (!selectedInvoice) return 'Select the original Sales invoice';
    if (contextState.loading) return 'Wait for the invoice return context';
    if (!contextState.data || contextState.data.items.length === 0) return 'Load a returnable invoice context';
    return null;
  }, [party, selectedInvoice, contextState.loading, contextState.data]);

  const submissionError = useMemo(() => {
    if (!company?.guid || !company?.name) return 'Company is not loaded';
    if (!party || !selectedInvoice) return 'Party and linked invoice are required';
    if (selectedInvoice.party && selectedInvoice.party.trim().toLowerCase() !== party.trim().toLowerCase()) {
      return 'Linked invoice does not belong to the selected party';
    }
    if (!selectedItems.length) return 'Select at least one returned item';
    for (const item of selectedItems) {
      const qty = num(item.returnQty);
      if (qty <= 0) return `Enter return quantity for ${item.itemName}`;
      if (qty > item.remainingQty) return `${item.itemName} exceeds remaining quantity`;
      if (item.rate <= 0) return `Original rate is missing for ${item.itemName}`;
      if (!item.salesLedger) return `Select Sales ledger for ${item.itemName}`;
      if (!item.godown) return `Select godown for ${item.itemName}`;
    }
    if (taxes.some(tax => !tax.ledger || num(tax.rate) < 0 || taxAmounts[taxes.indexOf(tax)] < 0)) {
      return 'Complete the tax ledger details';
    }
    if (!narration.trim()) return 'Reason / narration is required';
    return null;
  }, [company, party, selectedInvoice, selectedItems, taxes, taxAmounts, narration]);

  const handleSubmit = async () => {
    if (submissionError) {
      Alert.alert('Required', submissionError);
      return;
    }
    if (!isPaired) {
      Toast.show({ type: 'error', text1: 'Not Paired', text2: 'Pair with Tally Desktop first.' });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        companyGuid: company!.guid,
        companyName: company!.name,
        date: dmyToISO(date),
        partyLedger: party,
        totalAmount,
        items: selectedItems.map(item => ({
          lineId: item.lineId,
          itemName: item.itemName,
          actualQty: num(item.returnQty),
          billedQty: num(item.returnQty),
          unit: item.unit,
          rate: item.rate,
          amount: num(item.returnQty) * item.rate,
          salesLedger: item.salesLedger,
          godown: item.godown,
          soldQty: item.soldQty,
          previouslyReturnedQty: item.previouslyReturnedQty,
          remainingQty: item.remainingQty,
        })),
        taxes: taxes.map((tax, index) => ({
          ledgerName: tax.ledger,
          taxRate: num(tax.rate),
          taxAmount: taxAmounts[index],
          taxableValue: subtotal,
        })),
        isOptional: entryType === 'optional',
        original_entry_type: entryType,
        numbering_policy: numberingPolicy,
        linked_invoice: {
          invoiceGuid: selectedInvoice.guid || selectedInvoice.id,
          voucherNumber: selectedInvoice.voucherNumber,
          billRefName: selectedInvoice.billRefName || selectedInvoice.voucherNumber,
          tdkRef: selectedInvoice.tdkRef || undefined,
          date: selectedInvoice.date,
        },
        narration: narration.trim(),
      };

      const response: any = await createCreditNote(payload);
      const body = response?.data ?? response ?? {};
      setSubmitResult({
        tdkRef: String(first(body.tdkReferenceNo, body.tdkRef, body.tdk_reference_no, response?.tdkReferenceNo, response?.tdkRef, '') || ''),
        voucherNumber: first(body.voucherNumber, body.tallyVoucherNumber, body.tally_voucher_no, response?.voucherNumber),
        isQueued: response?.queued === true || body?.queued === true || String(first(body.status, response?.status, '')).toLowerCase() === 'queued',
      });
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Submit Failed', text2: error?.message || 'Could not create credit note.' });
    } finally {
      setSubmitting(false);
    }
  };

  const previewItems = useMemo(() => selectedItems.map((item, index) => ({
    no: String(index + 1),
    item: item.itemName,
    qty: `${formatQty(num(item.returnQty))}${item.unit ? ` ${item.unit}` : ''} × ${formatMoney(item.rate)}`,
    price: formatMoney(num(item.returnQty) * item.rate),
  })), [selectedItems]);

  const shareSubmitted = async () => {
    if (!submitResult || !selectedInvoice) return;
    await Share.share({
      title: 'Credit Note',
      message: [
        'Credit Note — Sales Return',
        `Voucher: ${submitResult.voucherNumber || 'Pending from TallyPrime'}`,
        submitResult.tdkRef ? `TDK Ref: ${submitResult.tdkRef}` : '',
        `Party: ${party}`,
        `Against: ${selectedInvoice.voucherNumber}`,
        `Date: ${date}`,
        `Amount: ${formatMoney(totalAmount)}`,
        `Reason: ${narration.trim()}`,
      ].filter(Boolean).join('\n'),
    });
  };

  const renderStepOne = () => (
    <>
      <Text style={s.sectionTitle}>Details & Invoice</Text>
      <View style={s.card}>
        <View style={s.row2}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>CN No.</Text>
            <View style={s.lockedField}>
              <Text style={s.lockedText}>Auto</Text>
              <Ionicons name="lock-closed-outline" size={14} color={COLORS.textTertiary} />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Date <Text style={s.required}>*</Text></Text>
            {entryType === 'regular' ? (
              <View style={[s.lockedField, { opacity: 0.65 }]}>
                <Text style={s.lockedText}>{date}</Text>
                <Ionicons name="lock-closed-outline" size={14} color={COLORS.textTertiary} />
              </View>
            ) : (
              <TouchableOpacity style={s.inputField} onPress={() => setShowDatePicker(true)}>
                <Text style={s.inputText}>{date}</Text>
                <Ionicons name="calendar-outline" size={17} color={COLORS.brandPrimary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
        <Text style={s.helper}>Numbering follows Settings → Voucher Config. Regular uses today; Optional can use any date inside the selected FY.</Text>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Sales Return</Text>
        {partiesState.error && <ErrorBanner message={partiesState.error} onRetry={partiesState.reload} />}
        <BottomSheetSearch
          label="Party Ledger"
          required
          placeholder={partiesState.loading ? 'Loading parties...' : 'Search party...'}
          options={partyOptions}
          value={party}
          onSelect={selectParty}
          onClear={() => { setParty(''); clearInvoice(); }}
          disabled={partiesState.loading}
          icon="person-outline"
        />

        {!!party && (
          <>
            {invoicesState.error && <ErrorBanner message={invoicesState.error} onRetry={invoicesState.reload} />}
            <BottomSheetSearch
              label="Original Sales Invoice"
              required
              placeholder={
                invoicesState.loading
                  ? 'Loading Sales invoices...'
                  : invoicesState.isEmpty
                    ? 'No Sales invoices in selected FY'
                    : 'Select Sales invoice...'
              }
              sheetTitle="Original Sales Invoice"
              options={invoiceOptions}
              value={selectedInvoice?.id || ''}
              onSelect={option => {
                setItems([]);
                setTaxes([]);
                setSelectedInvoice(option.data as InvoiceChoice);
              }}
              onClear={clearInvoice}
              disabled={invoicesState.loading || invoicesState.isEmpty}
              icon="document-text-outline"
            />
            {invoicesState.loading && <InlineState text={`Loading all Sales invoices for ${party}...`} loading />}
            {invoicesState.isEmpty && <InlineState text={`No Sales invoices found for ${party} in this financial year.`} />}
            {contextState.loading && <InlineState text={`Checking cumulative returns for #${selectedInvoice?.voucherNumber || ''}...`} loading />}
            {contextState.error && <ErrorBanner message={contextState.error} onRetry={contextState.reload} />}
            {contextState.isEmpty && <InlineState text="This invoice has no returnable inventory lines." />}
          </>
        )}
      </View>
    </>
  );

  const renderStepTwo = () => (
    <>
      <View style={s.invoiceSummary}>
        <View style={{ flex: 1 }}>
          <Text style={s.invoiceTitle}>Invoice #{selectedInvoice?.voucherNumber}</Text>
          <Text style={s.invoiceMeta}>{party} · {isoToDMY(selectedInvoice?.date || '')}</Text>
        </View>
        <TouchableOpacity onPress={() => setStep(1)} style={s.changeBtn}>
          <Text style={s.changeText}>Change</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.sectionTitle}>Returned Items & Review</Text>
      <View style={s.natureRow}>
        <Text style={s.natureLabel}>Nature</Text>
        <View style={s.natureBadge}><Text style={s.natureText}>Sales Return</Text></View>
      </View>

      {items.map(item => (
        <View key={item.id} style={[s.itemCard, item.selected && s.itemCardSelected, item.remainingQty <= 0 && { opacity: 0.6 }]}>
          <TouchableOpacity
            style={s.itemHead}
            onPress={() => item.remainingQty > 0 && toggleItem(item.id)}
            disabled={item.remainingQty <= 0}
          >
            <Ionicons
              name={item.selected ? 'checkbox' : 'square-outline'}
              size={23}
              color={item.selected ? COLORS.brandPrimary : COLORS.textTertiary}
            />
            <View style={{ flex: 1 }}>
              <Text style={s.itemName}>{item.itemName}</Text>
              <Text style={s.itemMeta}>
                Sold {formatQty(item.soldQty)} · Returned {formatQty(item.previouslyReturnedQty)} · Remaining {formatQty(item.remainingQty)} {item.unit}
              </Text>
            </View>
          </TouchableOpacity>

          {item.selected && (
            <View style={s.itemBody}>
              <View style={s.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Return Qty <Text style={s.required}>*</Text></Text>
                  <TextInput
                    style={s.textInput}
                    value={item.returnQty}
                    onChangeText={value => updateReturnQty(item, value)}
                    keyboardType="decimal-pad"
                    placeholder={`Max ${formatQty(item.remainingQty)}`}
                    placeholderTextColor={COLORS.textTertiary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Unit / Original Rate</Text>
                  <View style={s.lockedField}>
                    <Text style={s.lockedText}>{item.unit || '—'} · {formatMoney(item.rate)}</Text>
                    <Ionicons name="lock-closed-outline" size={13} color={COLORS.textTertiary} />
                  </View>
                </View>
              </View>
              <BottomSheetSearch
                label="Sales Ledger"
                required
                options={salesLedgerOptions}
                value={item.salesLedger}
                onSelect={option => updateItem(item.id, { salesLedger: option.value })}
                placeholder="Select original Sales ledger..."
                icon="book-outline"
              />
              <BottomSheetSearch
                label="Godown"
                required
                options={warehouseOptions}
                value={item.godown}
                onSelect={option => updateItem(item.id, { godown: option.value })}
                placeholder="Select original godown..."
                icon="business-outline"
                containerStyle={{ marginBottom: 0 }}
              />
              <View style={s.lineAmount}>
                <Text style={s.lineLabel}>Return value</Text>
                <Text style={s.lineValue}>{formatMoney(num(item.returnQty) * item.rate)}</Text>
              </View>
            </View>
          )}
        </View>
      ))}

      <Text style={s.sectionTitle}>Taxes from Original Invoice</Text>
      <View style={s.card}>
        {taxes.length === 0 ? (
          <Text style={s.emptyText}>No tax ledger entries were returned for this invoice.</Text>
        ) : taxes.map((tax, index) => (
          <View key={tax.id} style={[s.taxBlock, index < taxes.length - 1 && s.divider]}>
            <BottomSheetSearch
              label="Tax Ledger"
              required
              options={taxLedgerOptions}
              value={tax.ledger}
              onSelect={option => updateTax(tax.id, { ledger: option.value })}
              placeholder="Select tax ledger..."
              containerStyle={{ marginBottom: 10 }}
              icon="calculator-outline"
            />
            <View style={s.row2}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Rate %</Text>
                <TextInput
                  style={s.textInput}
                  value={tax.rate}
                  onChangeText={value => updateTax(tax.id, { rate: value.replace(/[^0-9.]/g, ''), manualAmount: false })}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Tax Amount</Text>
                <TextInput
                  style={s.textInput}
                  value={tax.manualAmount ? tax.amount : String(Number(taxAmounts[index].toFixed(2)))}
                  onChangeText={value => updateTax(tax.id, { amount: value.replace(/[^0-9.]/g, ''), manualAmount: true })}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          </View>
        ))}
      </View>

      <Text style={s.sectionTitle}>Reason & Summary</Text>
      <View
        style={s.card}
        onLayout={event => { narrationY.current = event.nativeEvent.layout.y; }}
      >
        <Text style={s.label}>Reason / Narration <Text style={s.required}>*</Text></Text>
        <TextInput
          style={s.textArea}
          value={narration}
          onChangeText={setNarration}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          placeholder="Why are these goods being returned?"
          placeholderTextColor={COLORS.textTertiary}
          onFocus={() => setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, narrationY.current - 80), animated: true }), 250)}
        />
        <View style={s.summary}>
          <SummaryRow label="Selected items" value={String(selectedItems.length)} />
          <SummaryRow label="Return subtotal" value={formatMoney(subtotal)} />
          <SummaryRow label="Taxes" value={formatMoney(taxTotal)} />
          <View style={s.summaryDivider} />
          <SummaryRow label="Credit Note total" value={formatMoney(totalAmount)} strong />
        </View>
      </View>
    </>
  );

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => step === 2 ? setStep(1) : router.back()}
          style={s.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Credit Note</Text>
          <Text style={s.headerSub}>Step {step} of 2</Text>
        </View>
        <RegularOptionalToggle value={entryType} onChange={setEntryType} />
      </View>

      <View style={s.progressTrack}>
        <View style={[s.progressFill, { width: step === 1 ? '50%' : '100%' }]} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'android' ? 80 : 0}
      >
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[s.scroll, { paddingBottom: 24 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={Keyboard.dismiss}
        >
          {step === 1 ? renderStepOne() : renderStepTwo()}
        </ScrollView>

        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {step === 2 && (
            <TouchableOpacity style={s.secondaryBtn} onPress={() => setStep(1)} disabled={submitting}>
              <Text style={s.secondaryText}>Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[s.primaryBtn, ((step === 1 && !!stepOneError) || (step === 2 && (!!submissionError || submitting))) && s.disabledBtn]}
            disabled={(step === 1 && !!stepOneError) || (step === 2 && (!!submissionError || submitting))}
            onPress={() => step === 1 ? setStep(2) : handleSubmit()}
          >
            {submitting ? <ActivityIndicator size="small" color={COLORS.white} /> : (
              <Ionicons name={step === 1 ? 'arrow-forward' : 'return-up-back'} size={18} color={COLORS.white} />
            )}
            <Text style={s.primaryText}>{submitting ? 'Submitting...' : step === 1 ? 'Continue' : 'Issue Credit Note'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <DatePickerModal
        visible={showDatePicker}
        value={date}
        minDate={fyStart}
        maxDate={fyEnd}
        onSelect={value => { setDate(value); setShowDatePicker(false); }}
        onClose={() => setShowDatePicker(false)}
        title="Credit Note Date"
      />

      {!!submitResult && (
        <View style={ss.overlay}>
          <View style={ss.card}>
            <Ionicons
              name={submitResult.isQueued ? 'time-outline' : 'checkmark-circle'}
              size={58}
              color={submitResult.isQueued ? COLORS.warning : COLORS.positive}
            />
            <Text style={ss.title}>{submitResult.isQueued ? 'Saved. Pending Sync' : 'Credit Note Posted'}</Text>
            <Text style={ss.subtitle}>
              {submitResult.isQueued
                ? 'Queued and ready to post when Tally Desktop reconnects.'
                : 'Sales Return sent to TallyPrime.'}
            </Text>
            <View style={ss.refBox}>
              <Text style={ss.refLabel}>Credit Note No.</Text>
              <Text style={ss.refValue}>{submitResult.voucherNumber || 'Pending from TallyPrime'}</Text>
            </View>
            {!!submitResult.tdkRef && (
              <View style={ss.refBox}>
                <Text style={ss.refLabel}>TDK Reference</Text>
                <Text style={ss.refValue}>{submitResult.tdkRef}</Text>
              </View>
            )}
            <View style={ss.actionRow}>
              <TouchableOpacity
                style={ss.actionBtn}
                onPress={() => router.push({
                  pathname: '/voucher/preview',
                  params: {
                    type: 'credit_note',
                    voucherNumber: submitResult.voucherNumber || 'Pending from TallyPrime',
                    date,
                    customer: party,
                    against: selectedInvoice?.voucherNumber || '',
                    amount: formatMoney(totalAmount),
                    narration: narration.trim(),
                    items: JSON.stringify(previewItems),
                    tdkRef: submitResult.tdkRef,
                  },
                } as any)}
              >
                <Ionicons name="eye-outline" size={18} color={COLORS.brandPrimary} />
                <Text style={ss.actionText}>Preview</Text>
              </TouchableOpacity>
              <TouchableOpacity style={ss.actionBtn} onPress={shareSubmitted}>
                <Ionicons name="share-outline" size={18} color={COLORS.brandPrimary} />
                <Text style={ss.actionText}>Share</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={ss.closeBtn} onPress={() => router.back()}>
              <Text style={ss.closeText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

function InlineState({ text, loading = false }: { text: string; loading?: boolean }) {
  return (
    <View style={s.inlineState}>
      {loading
        ? <ActivityIndicator size="small" color={COLORS.brandPrimary} />
        : <Ionicons name="information-circle-outline" size={18} color={COLORS.textTertiary} />}
      <Text style={s.inlineText}>{text}</Text>
    </View>
  );
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={s.summaryRow}>
      <Text style={[s.summaryLabel, strong && s.summaryStrong]}>{label}</Text>
      <Text style={[s.summaryValue, strong && s.summaryTotal]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: SPACING.md, paddingVertical: 12, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.pageBg },
  headerTitle: { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary },
  headerSub: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 1 },
  progressTrack: { height: 3, backgroundColor: COLORS.borderDefault },
  progressFill: { height: 3, backgroundColor: COLORS.brandPrimary },
  scroll: { padding: SPACING.md, gap: 12 },
  sectionTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '800', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginLeft: 2 },
  card: { backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.lg, padding: SPACING.md },
  cardTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 14 },
  row2: { flexDirection: 'row', gap: 10 },
  label: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 6 },
  required: { color: COLORS.negative },
  lockedField: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, backgroundColor: COLORS.pageBg },
  lockedText: { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  inputField: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, backgroundColor: COLORS.cardBg },
  inputText: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  textInput: { minHeight: 46, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, backgroundColor: COLORS.pageBg, color: COLORS.textPrimary, fontSize: TYPOGRAPHY.sm },
  helper: { marginTop: 10, fontSize: 11, color: COLORS.textTertiary, lineHeight: 16 },
  inlineState: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, backgroundColor: COLORS.pageBg, marginTop: 2 },
  inlineText: { flex: 1, fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, lineHeight: 17 },
  invoiceSummary: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, borderRadius: RADIUS.lg, backgroundColor: COLORS.brandPrimary + '10', borderWidth: 1, borderColor: COLORS.brandPrimary + '35' },
  invoiceTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary },
  invoiceMeta: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 3 },
  changeBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.brandPrimary },
  changeText: { fontSize: TYPOGRAPHY.xs, fontWeight: '800', color: COLORS.brandPrimary },
  natureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.cardBg, padding: 12, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md },
  natureLabel: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  natureBadge: { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: COLORS.negativeBg, borderRadius: RADIUS.full },
  natureText: { fontSize: TYPOGRAPHY.xs, fontWeight: '800', color: COLORS.negative },
  itemCard: { backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.lg, overflow: 'hidden' },
  itemCardSelected: { borderColor: COLORS.brandPrimary },
  itemHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: SPACING.md },
  itemName: { fontSize: TYPOGRAPHY.sm, fontWeight: '800', color: COLORS.textPrimary },
  itemMeta: { fontSize: 11, color: COLORS.textSecondary, marginTop: 4, lineHeight: 16 },
  itemBody: { padding: SPACING.md, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  lineAmount: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  lineLabel: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textSecondary },
  lineValue: { fontSize: TYPOGRAPHY.sm, fontWeight: '800', color: COLORS.negative },
  taxBlock: { paddingVertical: 4 },
  divider: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, paddingBottom: 14, marginBottom: 14 },
  emptyText: { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary, lineHeight: 20 },
  textArea: { minHeight: 90, padding: 12, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, backgroundColor: COLORS.pageBg, color: COLORS.textPrimary, fontSize: TYPOGRAPHY.sm },
  summary: { marginTop: 16, gap: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  summaryValue: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  summaryDivider: { height: 1, backgroundColor: COLORS.borderDefault, marginVertical: 3 },
  summaryStrong: { fontWeight: '800', color: COLORS.textPrimary },
  summaryTotal: { fontSize: TYPOGRAPHY.md, fontWeight: '900', color: COLORS.negative },
  footer: { flexDirection: 'row', gap: 10, paddingHorizontal: SPACING.md, paddingTop: 12, backgroundColor: COLORS.cardBg, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  primaryBtn: { flex: 1, minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: RADIUS.lg, backgroundColor: COLORS.negative },
  primaryText: { fontSize: TYPOGRAPHY.sm, fontWeight: '800', color: COLORS.white },
  secondaryBtn: { minWidth: 90, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault },
  secondaryText: { fontSize: TYPOGRAPHY.sm, fontWeight: '800', color: COLORS.textSecondary },
  disabledBtn: { opacity: 0.45 },
});

const ss = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 20, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.45)' },
  card: { width: '100%', maxWidth: 400, alignItems: 'center', gap: 12, padding: 24, borderRadius: RADIUS.lg, backgroundColor: COLORS.cardBg },
  title: { fontSize: 20, fontWeight: '900', color: COLORS.textPrimary, textAlign: 'center' },
  subtitle: { fontSize: TYPOGRAPHY.sm, lineHeight: 20, color: COLORS.textSecondary, textAlign: 'center' },
  refBox: { width: '100%', alignItems: 'center', padding: 10, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, backgroundColor: COLORS.pageBg },
  refLabel: { fontSize: 10, fontWeight: '800', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  refValue: { marginTop: 3, fontSize: TYPOGRAPHY.base, fontWeight: '900', color: COLORS.textPrimary },
  actionRow: { width: '100%', flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderWidth: 1.5, borderColor: COLORS.brandPrimary, borderRadius: RADIUS.md },
  actionText: { fontSize: TYPOGRAPHY.sm, fontWeight: '800', color: COLORS.brandPrimary },
  closeBtn: { paddingHorizontal: 18, paddingVertical: 8 },
  closeText: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textTertiary },
});
