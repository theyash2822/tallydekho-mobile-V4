import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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
  createDebitNote,
  getParties,
  getPurchaseInvoiceDebitNoteContext,
  getPurchaseInvoices,
  getPurchaseLedgerAccounts,
  getWarehouses,
} from '../../src/services/api';
import { shareVoucherPdfByRef } from '../../src/utils/voucherPdf';

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
  returnAmount: string;
  manualAmount: boolean;
  unit: string;
  rate: number;
  netTaxablePerUnit: number;
  discount: number;
  purchaseLedger: string;
  godown: string;
  taxRate?: number;
  taxEntries?: {
    ledgerName: string;
    taxRate: number;
    taxAmount: number;
    taxableValue?: number;
    kind?: string;
  }[];
};

type ReturnTax = {
  id: string;
  ledger: string;
  rate: string;
  amount: string;
  kind?: string;
};

type TaxGeometry = {
  allocationMode: 'item_attributed' | 'item_rate' | 'proportional' | 'none';
  fallbackUsed: boolean;
  isInterstate: boolean;
  originalTaxable: number;
  originalTaxTotal: number;
  singleSlabRate: number | null;
};

type DebitNoteContext = {
  invoice: InvoiceChoice;
  items: ReturnItem[];
  taxes: ReturnTax[];
  purchaseLedger: string;
  purchaseLedgerCandidates: string[];
  returnTaxMode: 'SALES_RETURN_WITH_GST' | 'SALES_RETURN_WITHOUT_GST';
  taxGeometry: TaxGeometry;
};

type SubmitResult = {
  tdkRef: string;
  voucherNumber?: string;
  isQueued: boolean;
};

type LineTaxRow = {
  ledger: string;
  rate: number;
  amount: number;
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

const unitNet = (item: ReturnItem) => (
  item.netTaxablePerUnit > 0 ? item.netTaxablePerUnit : item.rate
);

/** Line return taxable: qty × original net taxable/unit (or manual amount). */
const lineReturnAmount = (item: ReturnItem): number => {
  const qty = num(item.returnQty);
  if (qty <= 0) return 0;
  if (item.manualAmount) return Math.max(0, num(item.returnAmount));
  return Number((qty * unitNet(item)).toFixed(2));
};

const classifyTaxKind = (name: string) => {
  if (/igst/i.test(name)) return 'igst';
  if (/cgst/i.test(name)) return 'cgst';
  if (/sgst|utgst/i.test(name)) return 'sgst';
  if (/cess/i.test(name)) return 'cess';
  if (/vat/i.test(name)) return 'vat';
  if (/^\s*gst\s*$/i.test(name) || /^gst\s*\d/i.test(name) || /\bgst\b/i.test(name)) return 'gst';
  return 'other';
};

/** Match backend: drop bare GST when CGST/SGST/IGST already exist (logistics GST). */
const filterStockReturnTaxes = <T extends { ledger: string }>(rows: T[]): T[] => {
  const kinds = rows.map(r => classifyTaxKind(r.ledger));
  const hasSplit = kinds.some(k => k === 'cgst' || k === 'sgst' || k === 'igst');
  return rows.filter((row, i) => {
    const kind = kinds[i];
    if (kind === 'cgst' || kind === 'sgst' || kind === 'igst' || kind === 'cess' || kind === 'vat') return true;
    if (kind === 'gst') return !hasSplit;
    return false;
  });
};

/** Live GST reverse for one line — mirrors backend creditNoteTax.js. */
const lineGstRows = (
  item: ReturnItem,
  taxes: ReturnTax[],
  geometry: TaxGeometry,
  returnTaxMode: DebitNoteContext['returnTaxMode'],
): LineTaxRow[] => {
  const taxable = lineReturnAmount(item);
  if (!(taxable > 0) || returnTaxMode !== 'SALES_RETURN_WITH_GST' || geometry.allocationMode === 'none') {
    return [];
  }

  if (geometry.allocationMode === 'item_attributed' && Array.isArray(item.taxEntries) && item.taxEntries.length) {
    return item.taxEntries.map(te => {
      const ledger = String(te.ledgerName || '').trim();
      let rate = num(te.taxRate);
      const origTax = Math.abs(num(te.taxAmount));
      const origBase = Math.abs(num(te.taxableValue)) || (item.soldQty > 0 ? item.soldQty * unitNet(item) : 0);
      if (!(rate > 0) && origBase > 0 && origTax > 0) {
        rate = Number(((origTax / origBase) * 100).toFixed(2));
      }
      const amount = rate > 0
        ? Number((taxable * rate / 100).toFixed(2))
        : (origBase > 0 ? Number((origTax * (taxable / origBase)).toFixed(2)) : 0);
      return { ledger, rate, amount };
    }).filter(t => t.ledger && t.amount > 0);
  }

  if (geometry.allocationMode === 'proportional') {
    const base = geometry.originalTaxable > 0 ? geometry.originalTaxable : 0;
    return taxes.map(tax => {
      const rate = num(tax.rate);
      const fromShare = base > 0 && num(tax.amount) > 0
        ? Number((num(tax.amount) * (taxable / base)).toFixed(2))
        : 0;
      const fromRate = rate > 0 ? Number((taxable * rate / 100).toFixed(2)) : 0;
      return {
        ledger: tax.ledger,
        rate,
        amount: fromShare > 0 ? fromShare : fromRate,
      };
    }).filter(t => t.amount > 0);
  }

  const gstRate = item.taxRate || geometry.singleSlabRate || taxes.reduce((s, t) => s + num(t.rate), 0);
  if (!(gstRate > 0)) return [];

  const kinds = taxes.map(t => ({ ...t, kind: t.kind || classifyTaxKind(t.ledger) }));
  const cgst = kinds.filter(t => t.kind === 'cgst');
  const sgst = kinds.filter(t => t.kind === 'sgst');
  const igst = kinds.filter(t => t.kind === 'igst');
  const gst = kinds.filter(t => t.kind === 'gst');
  const vat = kinds.filter(t => t.kind === 'vat');
  const cess = kinds.filter(t => t.kind === 'cess');
  const rows: LineTaxRow[] = [];

  if (igst.length && geometry.isInterstate) {
    for (const tax of igst) {
      rows.push({
        ledger: tax.ledger,
        rate: Number((gstRate / igst.length).toFixed(2)),
        amount: Number((taxable * gstRate / igst.length / 100).toFixed(2)),
      });
    }
  } else if (cgst.length || sgst.length) {
    const half = gstRate / 2;
    for (const tax of cgst) {
      rows.push({
        ledger: tax.ledger,
        rate: Number((half / Math.max(1, cgst.length)).toFixed(2)),
        amount: Number((taxable * half / Math.max(1, cgst.length) / 100).toFixed(2)),
      });
    }
    for (const tax of sgst) {
      rows.push({
        ledger: tax.ledger,
        rate: Number((half / Math.max(1, sgst.length)).toFixed(2)),
        amount: Number((taxable * half / Math.max(1, sgst.length) / 100).toFixed(2)),
      });
    }
  } else if (gst.length) {
    for (const tax of gst) {
      rows.push({
        ledger: tax.ledger,
        rate: Number((gstRate / gst.length).toFixed(2)),
        amount: Number((taxable * gstRate / gst.length / 100).toFixed(2)),
      });
    }
  } else if (vat.length) {
    for (const tax of vat) {
      const rate = num(tax.rate) > 0 ? num(tax.rate) : gstRate;
      rows.push({
        ledger: tax.ledger,
        rate: Number((rate / vat.length).toFixed(2)),
        amount: Number((taxable * rate / vat.length / 100).toFixed(2)),
      });
    }
  }

  for (const tax of cess) {
    const rate = num(tax.rate);
    if (!(rate > 0)) continue;
    rows.push({
      ledger: tax.ledger,
      rate,
      amount: Number((taxable * rate / 100).toFixed(2)),
    });
  }

  return rows.filter(r => r.amount > 0);
};

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

function normalizeContext(raw: any, selected: InvoiceChoice): DebitNoteContext {
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

  // Backend context exposes defaultPurchaseLedger / purchaseLedgerCandidates — not body.purchaseLedger.
  const defaultPurchaseLedger = String(first(
    body.defaultPurchaseLedger,
    body.default_purchase_ledger,
    Array.isArray(body.purchaseLedgerCandidates) ? body.purchaseLedgerCandidates[0]?.ledgerName : '',
    Array.isArray(body.invoicePurchaseLedgers) ? body.invoicePurchaseLedgers[0]?.ledgerName : '',
    body.purchaseLedger,
    body.purchase_ledger,
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
    const rate = Math.abs(num(first(row.rate, row.originalRate, row.original_rate)));
    const soldAmount = Math.abs(num(first(row.soldAmount, row.sold_amount, row.amount)));
    const netTaxablePerUnit = Math.abs(num(first(
      row.netTaxablePerUnit,
      row.net_taxable_per_unit,
      soldQty > 0 && soldAmount > 0 ? soldAmount / soldQty : rate,
    )));
    return {
      id: String(first(row.id, row.lineId, row.line_id, row.inventoryEntryId, `${index}-${first(row.itemName, row.stock_item_name, row.name, 'item')}`)),
      lineId: first(row.lineId, row.line_id, row.inventoryEntryId, row.inventory_entry_id),
      itemName: String(first(row.itemName, row.item_name, row.stockItem, row.stock_item_name, row.name, '') || ''),
      soldQty,
      previouslyReturnedQty,
      remainingQty,
      selected: false,
      returnQty: '',
      returnAmount: '',
      manualAmount: false,
      unit: String(first(row.unit, row.baseUnit, row.base_unit, '') || ''),
      rate,
      netTaxablePerUnit: netTaxablePerUnit || rate,
      discount: Math.abs(num(first(row.discount, 0))),
      purchaseLedger: String(first(row.purchaseLedger, row.purchase_ledger, row.ledger, defaultPurchaseLedger, '') || ''),
      godown: String(first(row.godown, row.godownName, row.godown_name, row.warehouse, row.warehouseName, 'Main Location') || 'Main Location'),
      taxRate: num(first(row.gstRate, row.gst_rate, row.taxRate, row.tax_rate)) || undefined,
      taxEntries: Array.isArray(row.taxEntries)
        ? row.taxEntries.map((te: any) => ({
          ledgerName: String(first(te.ledgerName, te.ledger_name, te.ledger, '') || ''),
          taxRate: num(first(te.taxRate, te.tax_rate, te.rate)),
          taxAmount: Math.abs(num(first(te.taxAmount, te.tax_amount, te.amount))),
          taxableValue: Math.abs(num(first(te.taxableValue, te.taxable_value))),
          kind: String(first(te.kind, classifyTaxKind(String(te.ledgerName || te.ledger || '')))),
        })).filter((te: any) => te.ledgerName)
        : undefined,
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
  const taxes = filterStockReturnTaxes(
    (Array.isArray(sourceTaxes) ? sourceTaxes : []).reduce((acc: ReturnTax[], row: any, index: number) => {
    const ledger = String(first(row.ledger, row.ledgerName, row.ledger_name, row.name, '') || '');
    if (!ledger) return acc;
    const rate = num(first(row.rate, row.taxRate, row.tax_rate, row.percentage));
    const contextAmount = Math.abs(num(first(row.returnAmount, row.return_amount, row.amount, row.taxAmount, row.tax_amount)));
    const existing = acc.find(t => t.ledger.trim().toLowerCase() === ledger.trim().toLowerCase());
    if (existing) {
      const mergedAmount = num(existing.amount) + contextAmount;
      existing.amount = mergedAmount ? String(Number(mergedAmount.toFixed(2))) : existing.amount;
      if (rate > 0) {
        existing.rate = String(Number((num(existing.rate) + rate).toFixed(4)));
      }
      return acc;
    }
    acc.push({
      id: `${ledger}__${index}`,
      ledger,
      rate: String(rate || ''),
      amount: contextAmount ? String(contextAmount) : '',
      kind: String(first(row.kind, classifyTaxKind(ledger))),
    });
    return acc;
  }, []),
  );

  const candidateRows = (Array.isArray(body.purchaseLedgerCandidates) && body.purchaseLedgerCandidates.length > 0)
    ? body.purchaseLedgerCandidates
    : (Array.isArray(body.invoicePurchaseLedgers) && body.invoicePurchaseLedgers.length > 0)
      ? body.invoicePurchaseLedgers
      : (Array.isArray(body.companyPurchaseLedgers) ? body.companyPurchaseLedgers : []);
  const purchaseLedgerCandidates = candidateRows
    .map((row: any) => String(first(row?.ledgerName, row?.ledger_name, row?.name, typeof row === 'string' ? row : '') || ''))
    .filter(Boolean);

  const geometryRaw = body.taxGeometry || body.tax_geometry || {};
  const rawReturnTaxMode = String(first(body.returnTaxMode, body.return_tax_mode, ''));
  // Trust explicit server mode; only infer when context omitted it.
  const returnTaxMode: DebitNoteContext['returnTaxMode'] =
    rawReturnTaxMode === 'SALES_RETURN_WITHOUT_GST'
      ? 'SALES_RETURN_WITHOUT_GST'
      : rawReturnTaxMode === 'SALES_RETURN_WITH_GST'
        ? 'SALES_RETURN_WITH_GST'
        : (taxes.length > 0
          || num(body.gst?.cgstAmount) > 0
          || num(body.gst?.sgstAmount) > 0
          || num(body.gst?.igstAmount) > 0
          ? 'SALES_RETURN_WITH_GST'
          : 'SALES_RETURN_WITHOUT_GST');

  // gst.taxableAmount is often 0 on invoices that still have CGST/SGST ledger legs
  // (e.g. Tax Free Sale A/C + output GST). Never treat 0 as a real taxable base.
  const positive = (...values: unknown[]) => {
    for (const value of values) {
      const n = num(value);
      if (n > 0) return n;
    }
    return 0;
  };
  const inferredOriginalTaxable = positive(
    geometryRaw.originalTaxable,
    body.gst?.taxableAmount,
    body.totals?.purchaseLedgerTotal,
    body.totals?.itemsTotal,
    items.reduce((sum, item) => sum + (item.netTaxablePerUnit > 0 ? item.netTaxablePerUnit * item.soldQty : 0), 0),
  );
  const inferredOriginalTaxTotal = positive(
    geometryRaw.originalTaxTotal,
    body.totals?.taxTotal,
    taxes.reduce((sum, tax) => sum + num(tax.amount), 0),
  );

  const taxGeometry: TaxGeometry = {
    allocationMode: (['item_attributed', 'item_rate', 'proportional', 'none'].includes(String(geometryRaw.allocationMode))
      ? geometryRaw.allocationMode
      : (returnTaxMode === 'SALES_RETURN_WITHOUT_GST'
        ? 'none'
        : (items.every(i => Array.isArray(i.taxEntries) && (i.taxEntries?.length || 0) > 0)
          ? 'item_attributed'
          : (items.every(i => num(i.taxRate) > 0) && taxes.length > 0 ? 'item_rate' : 'proportional')))) as TaxGeometry['allocationMode'],
    fallbackUsed: !!geometryRaw.fallbackUsed || String(geometryRaw.allocationMode) === 'proportional',
    isInterstate: !!geometryRaw.isInterstate || (taxes.some(t => /igst/i.test(t.ledger)) && !taxes.some(t => /cgst|sgst/i.test(t.ledger))),
    originalTaxable: inferredOriginalTaxable,
    originalTaxTotal: inferredOriginalTaxTotal,
    singleSlabRate: geometryRaw.singleSlabRate != null && num(geometryRaw.singleSlabRate) > 0
      ? num(geometryRaw.singleSlabRate)
      : null,
  };

  return {
    invoice,
    items,
    taxes,
    purchaseLedger: String(first(defaultPurchaseLedger, items[0]?.purchaseLedger, purchaseLedgerCandidates[0], '') || ''),
    purchaseLedgerCandidates: [...new Set([defaultPurchaseLedger, ...purchaseLedgerCandidates, ...items.map(i => i.purchaseLedger)].filter(Boolean))],
    returnTaxMode,
    taxGeometry,
  };
}

export default function CreateDebitNoteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const narrationY = useRef(0);
  const narrationInputRef = useRef<TextInput>(null);
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
  const [returnTaxMode, setReturnTaxMode] = useState<DebitNoteContext['returnTaxMode']>('SALES_RETURN_WITHOUT_GST');
  const [taxGeometry, setTaxGeometry] = useState<TaxGeometry>({
    allocationMode: 'none',
    fallbackUsed: false,
    isInterstate: false,
    originalTaxable: 0,
    originalTaxTotal: 0,
    singleSlabRate: null,
  });
  const [invoicePurchaseLedgers, setInvoicePurchaseLedgers] = useState<string[]>([]);
  const [narration, setNarration] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [sharingPdf, setSharingPdf] = useState(false);
  const companyGuid = company?.guid;

  useEffect(() => {
    if (entryType === 'regular') setDate(todayDMY());
  }, [entryType]);

  useEffect(() => {
    if (!submitResult) return;
    narrationInputRef.current?.blur();
    Keyboard.dismiss();
    const t1 = setTimeout(() => Keyboard.dismiss(), 50);
    const t2 = setTimeout(() => Keyboard.dismiss(), 300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [submitResult]);

  const partiesState = useApiData<any[]>(
    () => getParties(company!.guid),
    [company?.guid],
    { enabled: !!company?.guid, transform: res => Array.isArray(res?.data) ? res.data : [] },
  );
  const purchaseLedgersState = useApiData<any[]>(
    () => getPurchaseLedgerAccounts(company!.guid),
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
    () => getPurchaseInvoices(company!.guid, {
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

  const contextState = useApiData<DebitNoteContext>(
    () => getPurchaseInvoiceDebitNoteContext(selectedInvoice!.id, company!.guid),
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
    setReturnTaxMode(contextState.data.returnTaxMode);
    setTaxGeometry(contextState.data.taxGeometry);
    setInvoicePurchaseLedgers(contextState.data.purchaseLedgerCandidates);
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

  const purchaseLedgerOptions: BSSOption[] = useMemo(() => {
    const names = new Set<string>();
    // Prefer ledgers the linked invoice actually posted to — backend rejects others.
    invoicePurchaseLedgers.forEach(name => name && names.add(name));
    items.forEach(item => item.purchaseLedger && names.add(item.purchaseLedger));
    if (names.size === 0) {
      (purchaseLedgersState.data || []).forEach((row: any) => row.name && names.add(row.name));
    }
    return [...names].map(name => ({ label: name, value: name }));
  }, [purchaseLedgersState.data, items, invoicePurchaseLedgers]);

  const warehouseOptions: BSSOption[] = useMemo(() => {
    const names = new Set<string>();
    (warehousesState.data || []).forEach((row: any) => {
      const name = first(row.name, row.godown_name);
      if (name) names.add(String(name));
    });
    items.forEach(item => item.godown && names.add(item.godown));
    return [...names].map(name => ({ label: name, value: name }));
  }, [warehousesState.data, items]);

  const selectedItems = useMemo(() => items.filter(item => item.selected), [items]);
  const subtotal = useMemo(() => selectedItems.reduce(
    (sum, item) => sum + lineReturnAmount(item),
    0,
  ), [selectedItems]);

  const lineTaxMap = useMemo(() => {
    const map = new Map<string, LineTaxRow[]>();
    for (const item of selectedItems) {
      map.set(item.id, lineGstRows(item, taxes, taxGeometry, returnTaxMode));
    }
    return map;
  }, [selectedItems, taxes, taxGeometry, returnTaxMode]);

  const computedTaxes = useMemo(() => {
    if (returnTaxMode !== 'SALES_RETURN_WITH_GST' || taxGeometry.allocationMode === 'none') return [];
    if (taxGeometry.allocationMode === 'proportional') {
      const base = taxGeometry.originalTaxable;
      return taxes.map(tax => {
        const rate = num(tax.rate);
        const fromShare = base > 0 && num(tax.amount) > 0
          ? Number((num(tax.amount) * (subtotal / base)).toFixed(2))
          : 0;
        const fromRate = rate > 0 ? Number((subtotal * rate / 100).toFixed(2)) : 0;
        const amount = fromShare > 0 ? fromShare : fromRate;
        return {
          id: tax.id,
          ledger: tax.ledger,
          rate,
          amount,
        };
      }).filter(t => t.amount > 0);
    }
    const byLedger = new Map<string, { id: string; ledger: string; rate: number; amount: number }>();
    for (const item of selectedItems) {
      for (const row of lineTaxMap.get(item.id) || []) {
        const key = row.ledger.trim().toLowerCase();
        const current = byLedger.get(key);
        if (current) {
          current.amount = Number((current.amount + row.amount).toFixed(2));
        } else {
          byLedger.set(key, { id: key, ledger: row.ledger, rate: row.rate, amount: row.amount });
        }
      }
    }
    return [...byLedger.values()];
  }, [returnTaxMode, taxGeometry, taxes, subtotal, selectedItems, lineTaxMap]);

  const taxTotal = computedTaxes.reduce((sum, tax) => sum + tax.amount, 0);
  const totalAmount = subtotal + taxTotal;

  const clearInvoice = useCallback(() => {
    setSelectedInvoice(null);
    setItems([]);
    setTaxes([]);
    setReturnTaxMode('SALES_RETURN_WITHOUT_GST');
    setTaxGeometry({
      allocationMode: 'none',
      fallbackUsed: false,
      isInterstate: false,
      originalTaxable: 0,
      originalTaxTotal: 0,
      singleSlabRate: null,
    });
    setInvoicePurchaseLedgers([]);
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
    setItems(current => current.map(item => {
      if (item.id !== id) return item;
      if (item.selected) {
        return {
          ...item,
          selected: false,
          returnQty: '',
          returnAmount: '',
          manualAmount: false,
        };
      }
      const qty = item.remainingQty;
      const amount = qty > 0 && unitNet(item) > 0
        ? String(Number((qty * unitNet(item)).toFixed(2)))
        : '';
      return {
        ...item,
        selected: true,
        returnQty: qty > 0 ? formatQty(qty) : '',
        returnAmount: amount,
        manualAmount: false,
      };
    }));
  }, []);

  const updateReturnQty = useCallback((item: ReturnItem, value: string) => {
    const sanitized = value.replace(/[^0-9.]/g, '');
    const parsed = num(sanitized);
    const capped = parsed > item.remainingQty ? formatQty(item.remainingQty) : sanitized;
    const qty = num(capped);
    const net = unitNet(item);
    updateItem(item.id, {
      returnQty: capped,
      returnAmount: qty > 0 ? String(Number((qty * net).toFixed(2))) : '',
      manualAmount: false,
      selected: qty > 0 ? true : item.selected,
    });
  }, [updateItem]);

  const updateReturnAmount = useCallback((item: ReturnItem, value: string) => {
    if (num(item.returnQty) <= 0) return;
    const sanitized = value.replace(/[^0-9.]/g, '');
    updateItem(item.id, { returnAmount: sanitized, manualAmount: true });
  }, [updateItem]);

  const stepOneError = useMemo(() => {
    if (!party) return 'Select a vendor';
    if (!selectedInvoice) return 'Select the original Purchase invoice';
    if (contextState.loading) return 'Wait for the invoice return context';
    if (!contextState.data || contextState.data.items.length === 0) return 'Load a returnable invoice context';
    return null;
  }, [party, selectedInvoice, contextState.loading, contextState.data]);

  const submissionError = useMemo(() => {
    if (!company?.guid || !company?.name) return 'Company is not loaded';
    if (!party || !selectedInvoice) return 'Vendor and linked invoice are required';
    if (selectedInvoice.party && selectedInvoice.party.trim().toLowerCase() !== party.trim().toLowerCase()) {
      return 'Linked invoice does not belong to the selected vendor';
    }
    if (!selectedItems.length) return 'Select at least one returned item';
    for (const item of selectedItems) {
      const qty = num(item.returnQty);
      if (qty <= 0) return `Enter return quantity for ${item.itemName}`;
      if (qty > item.remainingQty) return `${item.itemName} exceeds remaining quantity`;
      if (item.rate <= 0) return `Original rate is missing for ${item.itemName}`;
      if (lineReturnAmount(item) <= 0) return `Enter return amount for ${item.itemName}`;
      if (!item.purchaseLedger) return `Select Purchase ledger for ${item.itemName}`;
      if (!item.godown) return `Select godown for ${item.itemName}`;
    }
    if (returnTaxMode === 'SALES_RETURN_WITH_GST' && computedTaxes.some(tax => !tax.ledger || tax.amount < 0)) {
      return 'Complete the tax ledger details';
    }
    if (!narration.trim()) return 'Reason / narration is required';
    return null;
  }, [company, party, selectedInvoice, selectedItems, returnTaxMode, computedTaxes, narration]);

  const handleSubmit = async () => {
    // Same pattern as Purchase Invoice: dismiss BEFORE validation so the success
    // modal never sits under a still-focused narration field / iOS keyboard.
    narrationInputRef.current?.blur();
    Keyboard.dismiss();

    if (submissionError) {
      Alert.alert('Required', submissionError);
      return;
    }
    if (!selectedInvoice) return;
    if (!isPaired) {
      Toast.show({ type: 'error', text1: 'Not Paired', text2: 'Pair with Tally Desktop first.' });
      return;
    }
    if (submittingRef.current) return;

    setSubmitting(true);
    submittingRef.current = true;
    try {
      const payload = {
        companyGuid: company!.guid,
        companyName: company!.name,
        date: dmyToISO(date),
        partyLedger: party,
        totalAmount,
        items: selectedItems.map(item => {
          const amount = lineReturnAmount(item);
          const qty = num(item.returnQty);
          return {
            lineId: item.lineId,
            itemName: item.itemName,
            actualQty: qty,
            billedQty: qty,
            unit: item.unit,
            rate: qty > 0 ? amount / qty : item.rate,
            originalRate: item.rate,
            amount,
            purchaseLedger: item.purchaseLedger,
            godown: item.godown,
            soldQty: item.soldQty,
            previouslyReturnedQty: item.previouslyReturnedQty,
            remainingQty: item.remainingQty,
          };
        }),
        taxes: computedTaxes.map(tax => ({
          ledgerName: tax.ledger,
          taxRate: tax.rate,
          taxAmount: tax.amount,
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

      const response: any = await createDebitNote(payload);
      const body = response?.data ?? response ?? {};
      Keyboard.dismiss();
      setSubmitResult({
        tdkRef: String(first(body.tdkReferenceNo, body.tdkRef, body.tdk_reference_no, response?.tdkReferenceNo, response?.tdkRef, '') || ''),
        voucherNumber: first(body.voucherNumber, body.debitNoteNumber, body.tallyVoucherNumber, body.tally_voucher_no, response?.voucherNumber),
        isQueued: response?.queued === true || body?.queued === true || String(first(body.status, response?.status, '')).toLowerCase() === 'queued',
      });
      return;
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Submit Failed', text2: error?.message || 'Could not create debit note.' });
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const shareSubmitted = async () => {
    if (!submitResult?.tdkRef || !companyGuid) return;
    setSharingPdf(true);
    try {
      await shareVoucherPdfByRef(submitResult.tdkRef, companyGuid, {
        documentType: 'debit_note',
        onBeforeShare: () => setSharingPdf(false),
      });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'PDF Error', text2: e?.message || 'Could not generate PDF' });
    } finally {
      setSharingPdf(false);
    }
  };

  const renderStepOne = () => (
    <>
      <Text style={s.sectionTitle}>Details & Invoice</Text>
      <View style={s.card}>
        <View style={s.row2}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>DBN No.</Text>
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
        <Text style={s.cardTitle}>Purchase Return</Text>
        {partiesState.error && <ErrorBanner message={partiesState.error} onRetry={partiesState.reload} />}
        <BottomSheetSearch
          label="Vendor"
          required
          placeholder={partiesState.loading ? 'Loading vendors...' : 'Search vendor...'}
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
              label="Original Purchase Invoice"
              required
              placeholder={
                invoicesState.loading
                  ? 'Loading Purchase invoices...'
                  : invoicesState.isEmpty
                    ? 'No Purchase invoices in selected FY'
                    : 'Select Purchase invoice...'
              }
              sheetTitle="Original Purchase Invoice"
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
            {invoicesState.loading && <InlineState text={`Loading all Purchase invoices for ${party}...`} loading />}
            {invoicesState.isEmpty && <InlineState text={`No Purchase invoices found for ${party} in this financial year.`} />}
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
        <View style={s.natureBadge}><Text style={s.natureText}>Purchase Return</Text></View>
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
                Billed {formatQty(item.soldQty)} · Returned {formatQty(item.previouslyReturnedQty)} · Remaining {formatQty(item.remainingQty)} {item.unit}
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
                  <Text style={s.label}>Unit / Original Net Rate</Text>
                  <View style={s.lockedField}>
                    <Text style={s.lockedText}>{item.unit || '—'} · {formatMoney(unitNet(item))}</Text>
                    <Ionicons name="lock-closed-outline" size={13} color={COLORS.textTertiary} />
                  </View>
                </View>
              </View>
              <BottomSheetSearch
                label="Purchase Ledger"
                required
                options={purchaseLedgerOptions}
                value={item.purchaseLedger}
                onSelect={option => updateItem(item.id, { purchaseLedger: option.value })}
                placeholder="Select original Purchase ledger..."
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
              <View style={s.amountField}>
                <Text style={s.label}>Returned Taxable Value <Text style={s.required}>*</Text></Text>
                <TextInput
                  style={[s.textInput, num(item.returnQty) <= 0 && s.textInputDisabled]}
                  value={item.returnAmount}
                  onChangeText={value => updateReturnAmount(item, value)}
                  keyboardType="decimal-pad"
                  editable={num(item.returnQty) > 0}
                  placeholder={num(item.returnQty) > 0
                    ? formatMoney(num(item.returnQty) * unitNet(item))
                    : 'Enter return quantity first'}
                  placeholderTextColor={COLORS.textTertiary}
                />
                <Text style={s.amountHelper}>
                  {num(item.returnQty) > 0
                    ? (item.manualAmount
                      ? 'Edited manually — change qty to recalculate from original invoice net rate.'
                      : `Auto from ${formatQty(num(item.returnQty))} × ${formatMoney(unitNet(item))} (original net taxable/unit).`)
                    : 'Enter Return Qty first — amount fills from original invoice.'}
                </Text>
              </View>
              {(lineTaxMap.get(item.id) || []).length > 0 && (
                <View style={s.lineTaxBox}>
                  <Text style={s.lineTaxTitle}>GST reversal (this item)</Text>
                  {(lineTaxMap.get(item.id) || []).map(row => (
                    <View key={`${item.id}-${row.ledger}`} style={s.lineTaxRow}>
                      <Text style={s.lineTaxLabel}>{row.ledger}{row.rate > 0 ? ` @ ${row.rate}%` : ''}</Text>
                      <Text style={s.lineTaxValue}>{formatMoney(row.amount)}</Text>
                    </View>
                  ))}
                  <View style={s.lineTaxRow}>
                    <Text style={s.lineTaxTotalLabel}>Line debit</Text>
                    <Text style={s.lineTaxTotalValue}>
                      {formatMoney(lineReturnAmount(item) + (lineTaxMap.get(item.id) || []).reduce((sum, row) => sum + row.amount, 0))}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>
      ))}

      <Text style={s.sectionTitle}>GST Reversal</Text>
      <View style={s.card}>
        {returnTaxMode === 'SALES_RETURN_WITHOUT_GST' ? (
          <Text style={s.emptyText}>Original invoice had no GST — no tax will be reversed.</Text>
        ) : computedTaxes.length === 0 ? (
          <Text style={s.emptyText}>Select returned items to see GST reversal.</Text>
        ) : (
          <>
            {taxGeometry.fallbackUsed || taxGeometry.allocationMode === 'proportional' ? (
              <Text style={s.taxIntro}>
                Tax allocated from original invoice totals (proportional to returned taxable value).
              </Text>
            ) : (
              <Text style={s.taxIntro}>
                GST reversed from original invoice rates (CGST/SGST or IGST). Not today’s item master.
              </Text>
            )}
            {computedTaxes.map((tax, index) => (
              <View key={tax.id} style={[s.taxBlock, index < computedTaxes.length - 1 && s.divider]}>
                <View style={s.row2}>
                  <View style={{ flex: 1.4 }}>
                    <Text style={s.label}>Tax Ledger</Text>
                    <View style={s.lockedField}>
                      <Text style={s.lockedText}>{tax.ledger}</Text>
                      <Ionicons name="lock-closed-outline" size={13} color={COLORS.textTertiary} />
                    </View>
                  </View>
                  <View style={{ flex: 0.7 }}>
                    <Text style={s.label}>Rate %</Text>
                    <View style={s.lockedField}>
                      <Text style={s.lockedText}>{tax.rate > 0 ? String(tax.rate) : '—'}</Text>
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.label}>Tax Amount</Text>
                    <View style={s.lockedField}>
                      <Text style={s.lockedText}>{formatMoney(tax.amount)}</Text>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </>
        )}
      </View>

      <Text style={s.sectionTitle}>Reason & Summary</Text>
      <View
        style={s.card}
        onLayout={event => { narrationY.current = event.nativeEvent.layout.y; }}
      >
        <Text style={s.label}>Reason / Narration <Text style={s.required}>*</Text></Text>
        <TextInput
          ref={narrationInputRef}
          style={s.textArea}
          value={narration}
          onChangeText={setNarration}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          placeholder="Why are these goods being returned?"
          placeholderTextColor={COLORS.textTertiary}
          blurOnSubmit
          onFocus={() => setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, narrationY.current - 80), animated: true }), 250)}
        />
        <View style={s.summary}>
          <SummaryRow label="Selected items" value={String(selectedItems.length)} />
          <SummaryRow label="Returned item value" value={formatMoney(subtotal)} />
          <SummaryRow label="GST reversal" value={formatMoney(taxTotal)} />
          <View style={s.summaryDivider} />
          <SummaryRow label="Total vendor debit" value={formatMoney(totalAmount)} strong />
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
          <Text style={s.headerTitle}>Debit Note</Text>
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
        enabled={!submitResult}
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
          {!!(step === 1 ? stepOneError : submissionError) && (
            <Text style={s.footerError}>{step === 1 ? stepOneError : submissionError}</Text>
          )}
          <View style={s.footerRow}>
            {step === 2 && (
              <TouchableOpacity style={s.secondaryBtn} onPress={() => setStep(1)} disabled={submitting}>
                <Text style={s.secondaryText}>Back</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[s.primaryBtn, ((step === 1 && !!stepOneError) || (step === 2 && (!!submissionError || submitting))) && s.disabledBtn]}
              disabled={(step === 1 && !!stepOneError) || (step === 2 && (!!submissionError || submitting))}
              onPress={() => {
                narrationInputRef.current?.blur();
                Keyboard.dismiss();
                if (step === 1) setStep(2);
                else handleSubmit();
              }}
            >
              {submitting ? <ActivityIndicator size="small" color={COLORS.white} /> : (
                <Ionicons name={step === 1 ? 'arrow-forward' : 'return-up-back'} size={18} color={COLORS.white} />
              )}
              <Text style={s.primaryText}>{submitting ? 'Submitting...' : step === 1 ? 'Continue' : 'Issue Debit Note'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      <DatePickerModal
        visible={showDatePicker}
        value={date}
        minDate={fyStart}
        maxDate={fyEnd}
        onSelect={value => { setDate(value); setShowDatePicker(false); }}
        onClose={() => setShowDatePicker(false)}
        title="Debit Note Date"
      />

      {!!submitResult && (
        <View
          style={ss.overlay}
          onStartShouldSetResponder={() => {
            Keyboard.dismiss();
            return true;
          }}
        >
          <View style={ss.card}>
            <Ionicons
              name={submitResult.isQueued ? 'time-outline' : 'checkmark-circle'}
              size={58}
              color={submitResult.isQueued ? COLORS.warning : COLORS.positive}
            />
            <Text style={ss.title}>{submitResult.isQueued ? 'Saved. Pending Sync' : 'Debit Note Posted'}</Text>
            <Text style={ss.subtitle}>
              {submitResult.isQueued
                ? 'Queued and ready to post when Tally Desktop reconnects.'
                : 'Purchase Return sent to TallyPrime.'}
            </Text>
            <View style={ss.refBox}>
              <Text style={ss.refLabel}>Debit Note No.</Text>
              <Text style={ss.refValue}>
                {submitResult.voucherNumber
                  || (submitResult.isQueued ? 'Will be assigned when synced' : 'Check Day Book in TallyPrime')}
              </Text>
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
                disabled={!submitResult.tdkRef}
                onPress={() => {
                  Keyboard.dismiss();
                  router.push(`/purchase/debit-note-preview?tdkRef=${encodeURIComponent(submitResult.tdkRef!)}` as any);
                }}
              >
                <Ionicons name="eye-outline" size={18} color={COLORS.brandPrimary} />
                <Text style={ss.actionText}>Preview</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={ss.actionBtn}
                disabled={sharingPdf || !submitResult.tdkRef}
                onPress={() => { Keyboard.dismiss(); shareSubmitted(); }}
              >
                {sharingPdf
                  ? <ActivityIndicator size="small" color={COLORS.brandPrimary} />
                  : <Ionicons name="share-outline" size={18} color={COLORS.brandPrimary} />}
                <Text style={ss.actionText}>{sharingPdf ? 'Generating…' : 'Share PDF'}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={ss.closeBtn} onPress={() => { Keyboard.dismiss(); router.back(); }}>
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
  textInputDisabled: { opacity: 0.55 },
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
  natureBadge: { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: COLORS.activeBg, borderRadius: RADIUS.full },
  natureText: { fontSize: TYPOGRAPHY.xs, fontWeight: '800', color: COLORS.textPrimary },
  itemCard: { backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.lg, overflow: 'hidden' },
  itemCardSelected: { borderColor: COLORS.brandPrimary },
  itemHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: SPACING.md },
  itemName: { fontSize: TYPOGRAPHY.sm, fontWeight: '800', color: COLORS.textPrimary },
  itemMeta: { fontSize: 11, color: COLORS.textSecondary, marginTop: 4, lineHeight: 16 },
  itemBody: { padding: SPACING.md, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  amountField: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  amountHelper: { marginTop: 5, fontSize: 10, color: COLORS.textTertiary, lineHeight: 14 },
  lineTaxBox: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.borderDefault, gap: 6 },
  lineTaxTitle: { fontSize: 11, fontWeight: '800', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3 },
  lineTaxRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lineTaxLabel: { fontSize: 12, color: COLORS.textSecondary, flex: 1 },
  lineTaxValue: { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary },
  lineTaxTotalLabel: { fontSize: 12, fontWeight: '800', color: COLORS.textPrimary },
  lineTaxTotalValue: { fontSize: 13, fontWeight: '900', color: COLORS.textPrimary },
  taxIntro: { fontSize: 11, color: COLORS.textTertiary, lineHeight: 16, marginBottom: 12 },
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
  summaryTotal: { fontSize: TYPOGRAPHY.md, fontWeight: '900', color: COLORS.textPrimary },
  footer: { gap: 8, paddingHorizontal: SPACING.md, paddingTop: 12, backgroundColor: COLORS.cardBg, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  footerError: { fontSize: 12, fontWeight: '600', color: COLORS.negative, lineHeight: 16 },
  footerRow: { flexDirection: 'row', gap: 10 },
  primaryBtn: { flex: 1, minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: RADIUS.lg, backgroundColor: COLORS.brandPrimary },
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
