/**
 * create-delivery-note.tsx
 * Delivery Note — 3-step create flow (Sales Invoice REG/OPT date lock)
 *
 * Step 1 "Details"           — sales ledger, DN no, party, date, optional Linked SO
 * Step 2 "Order & Dispatch"  — screenshot Order + Dispatch fields
 * Step 3 "Items & Logistics" — SO-prefilled or manual items, taxes, logistics, submit
 *
 * All masters are live (no mock arrays). Numbering comes from Settings → Voucher
 * Config via `useNumberingPolicy`; the screen never invents a voucher number.
 */
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, TextInput, TextInputProps, ActivityIndicator, Keyboard, KeyboardAvoidingView,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import {
  getParties, createDeliveryNote, getStocks, getWarehouses,
  getSalesLedgerAccounts, getTaxLedgers, getChargeLedgers, getStockGodowns,
  getSalesOrders, getVoucherById, getOrderPreview,
} from '../../src/services/api';
import { useNumberingPolicy } from '../../src/hooks/useNumberingPolicy';
import FormField from '../../src/components/forms/FormField';
import RegularOptionalToggle, { EntryType } from '../../src/components/forms/RegularOptionalToggle';
import LogisticsSection, { LogEntry, calcLogisticsTotal } from '../../src/components/forms/LogisticsSection';
import DatePickerModal from '../../src/components/forms/DatePickerModal';
import BottomSheetSearch, { BSSOption } from '../../src/components/forms/BottomSheetSearch';

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

/** Backend voucher rows carry `date` as YYYY-MM-DD (or a timestamp) — keep the date part only. */
const toISODate = (raw: any): string => (raw ? String(raw).slice(0, 10) : '');

const isoToDMY = (iso: string): string => {
  const clean = toISODate(iso);
  if (clean.length < 10) return '';
  const [y, m, d] = clean.split('-');
  return `${d}/${m}/${y.slice(-2)}`;
};

const calcItem = (item: DNItem) => {
  const qty = parseFloat(item.qty) || 0;
  const rate = parseFloat(item.rate) || 0;
  const amount = qty * rate;
  const taxAmt = (item.taxEntries || []).reduce((sum, t) => {
    const override = parseFloat(t.taxAmount);
    if (!isNaN(override) && t.taxAmount.trim() !== '') return sum + override;
    return sum + amount * (parseFloat(t.taxRate) || 0) / 100;
  }, 0);
  return { amount, taxAmt, subtotal: amount + taxAmt };
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface StockItem {
  id?: number;
  guid?: string;        // Tally GUID — used for godowns API lookup
  name: string;
  displayName?: string;
  closing_qty?: number;
  unit?: string;
  rate?: number;
  hsn?: string;
}

interface Warehouse { id: number; name: string; guid?: string; }
interface Godown { name: string; qty: number; }

interface TaxLedgerEntry {
  id: string;
  ledgerName: string;
  taxRate: string;
  taxAmount: string;
}

interface DNItem {
  id: string;
  warehouse: string;
  product: string;
  qty: string;
  unit: string;
  rate: string;
  salesLedger: string;
  taxEntries: TaxLedgerEntry[];
}

interface LinkedOrder {
  voucherNumber: string;
  date: string;
  guid?: string;
  tdkRef?: string;
}

const newItem = (salesLedger = '', warehouseName = ''): DNItem => ({
  id: Date.now().toString() + Math.random().toString(36).slice(2),
  warehouse: warehouseName, product: '', qty: '1', unit: '', rate: '',
  salesLedger, taxEntries: [],
});

// ─── ThemedFInput ──────────────────────────────────────────────────────────────
function ThemedFInput({ style, onFocus, onBlur, keyboardType, ...props }: TextInputProps) {
  const [focused, setFocused] = useState(false);
  const isNumeric = keyboardType === 'numeric' || keyboardType === 'decimal-pad' || keyboardType === 'number-pad';
  return (
    <TextInput
      style={[
        s.fInput,
        focused && s.fInputFocused,
        Platform.select({ web: { outlineWidth: 0, outlineStyle: 'none' } as any }),
        style,
      ]}
      placeholderTextColor={COLORS.textTertiary}
      keyboardType={keyboardType}
      selectTextOnFocus={isNumeric}
      onFocus={(e) => { setFocused(true); onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); onBlur?.(e); }}
      {...props}
    />
  );
}

// ─── StepIndicator ────────────────────────────────────────────────────────────
function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  const STEPS = [
    { num: 1 as const, label: 'Details' },
    { num: 2 as const, label: 'Order & Dispatch' },
    { num: 3 as const, label: 'Items & Logistics' },
  ];
  return (
    <View style={si.wrap}>
      {STEPS.map((st, idx) => (
        <React.Fragment key={st.num}>
          <View style={si.stepItem}>
            <View style={[si.circle, step === st.num && si.circleActive, step > st.num && si.circleDone]}>
              {step > st.num
                ? <Ionicons name="checkmark" size={13} color={COLORS.white} />
                : <Text style={[si.circleNum, step === st.num && si.circleNumActive]}>{st.num}</Text>}
            </View>
            <Text style={[si.label, step === st.num && si.labelActive]} numberOfLines={1}>{st.label}</Text>
          </View>
          {idx < STEPS.length - 1 && <View style={[si.line, step > st.num && si.lineDone]} />}
        </React.Fragment>
      ))}
    </View>
  );
}

// ─── TaxEntryRow ─────────────────────────────────────────────────────────────
function TaxEntryRow({ entry, taxLedgers, onUpdate, onRemove, taxable }: {
  entry: TaxLedgerEntry;
  taxLedgers: { name: string }[];
  onUpdate: (field: keyof TaxLedgerEntry, val: string) => void;
  onRemove: () => void;
  taxable: number;
}) {
  const taxOpts: BSSOption[] = taxLedgers.map(l => ({ label: l.name, value: l.name }));
  return (
    <View style={ir.taxEntryCard}>
      <View style={ir.taxEntryTopRow}>
        <View style={{ flex: 1 }}>
          <BottomSheetSearch
            compact
            options={taxOpts}
            value={entry.ledgerName}
            onSelect={opt => onUpdate('ledgerName', opt.value)}
            onClear={() => onUpdate('ledgerName', '')}
            placeholder="Select tax ledger..."
            sheetTitle="Tax Ledger"
          />
        </View>
        <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ padding: 4 }}>
          <Ionicons name="close-circle" size={16} color={COLORS.negative} />
        </TouchableOpacity>
      </View>
      <View style={[ir.taxEntryBottomRow, !entry.ledgerName && { opacity: 0.38 }]} pointerEvents={entry.ledgerName ? 'auto' : 'none'}>
        <View style={ir.taxFieldGroup}>
          <Text style={ir.taxMiniLbl}>Rate</Text>
          <View style={ir.taxFieldInputRow}>
            <TextInput
              style={ir.taxRateInput}
              value={entry.taxRate}
              onChangeText={v => {
                onUpdate('taxRate', v);
                const auto = (taxable * (parseFloat(v) || 0) / 100).toFixed(2);
                onUpdate('taxAmount', auto);
              }}
              keyboardType="numeric"
              placeholder={entry.ledgerName ? '0' : 'Select ledger first'}
              placeholderTextColor={COLORS.textTertiary}
              editable={!!entry.ledgerName}
            />
            <Text style={ir.taxRateSign}>%</Text>
          </View>
        </View>
        <Ionicons name="arrow-forward-outline" size={13} color={COLORS.textTertiary} style={{ marginTop: 16 }} />
        <View style={[ir.taxFieldGroup, { flex: 1 }]}>
          <Text style={ir.taxMiniLbl}>Amount</Text>
          <View style={ir.taxFieldInputRow}>
            <Text style={ir.taxRateSign}>₹</Text>
            <TextInput
              style={[ir.taxAmtInput, { flex: 1, width: undefined }]}
              value={entry.taxAmount}
              onChangeText={v => onUpdate('taxAmount', v)}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor={COLORS.textTertiary}
              editable={!!entry.ledgerName}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── ItemRow ─────────────────────────────────────────────────────────────────
function ItemRow({
  item, stockItems, taxLedgers, salesLedgers, godowns,
  onProductSelect, onProductClear, onUpdate, onRemove,
  onAddTaxEntry, onUpdateTaxEntry, onRemoveTaxEntry,
  itemIndex, canRemove,
}: {
  item: DNItem;
  stockItems: StockItem[];
  taxLedgers: { name: string }[];
  salesLedgers: { name: string; guid?: string }[];
  godowns: Godown[];
  onProductSelect: (itemId: string, opt: BSSOption) => void;
  onProductClear: (itemId: string) => void;
  onUpdate: (id: string, field: keyof DNItem, val: string) => void;
  onRemove: (id: string) => void;
  onAddTaxEntry: (itemId: string) => void;
  onUpdateTaxEntry: (itemId: string, entryId: string, field: keyof TaxLedgerEntry, val: string) => void;
  onRemoveTaxEntry: (itemId: string, entryId: string) => void;
  itemIndex: number;
  canRemove: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const calc = calcItem(item);

  const stockOpts: BSSOption[] = stockItems.map(si2 => ({
    label: si2.displayName || si2.name,
    value: si2.name,
    subtitle: `${si2.closing_qty ?? 0} ${si2.unit || 'pcs'}`,
  }));

  const stockItem = stockItems.find(si2 => si2.name === item.product);
  const productLabel = stockItem ? (stockItem.displayName || stockItem.name) : '';
  const headerLabel = productLabel || `Item ${itemIndex + 1}`;

  // Warehouse options: per-item godowns when loaded, else Main Location fallback.
  const warehouseOpts: BSSOption[] = godowns.length > 0
    ? godowns.map(g => ({ label: g.name, value: g.name, subtitle: `${Math.round(g.qty)} ${stockItem?.unit || 'units'} available` }))
    : item.product
      ? [{ label: 'Main Location', value: 'Main Location', subtitle: stockItem?.closing_qty != null ? `${Math.round(stockItem.closing_qty)} ${stockItem?.unit || 'units'} available` : 'Default warehouse' }]
      : [];
  const needsWarehouseDropdown = item.product ? warehouseOpts.length >= 1 : false;

  return (
    <View style={ir.card}>
      <View style={ir.rowHeader}>
        <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }} onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
          <Ionicons name="cube-outline" size={14} color={item.product ? COLORS.brandPrimary : COLORS.textSecondary} />
          <Text style={[ir.rowHeaderTxt, item.product ? ir.rowHeaderTxtActive : undefined]} numberOfLines={1}>
            {headerLabel}
          </Text>
          {item.product && calc.subtotal > 0 && (
            <Text style={ir.rowHeaderAmt}>₹{calc.subtotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
          )}
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.textSecondary} />
        </TouchableOpacity>
        {canRemove && (
          <TouchableOpacity onPress={() => onRemove(item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={ir.headerTrashBtn} activeOpacity={0.7}>
            <Ionicons name="trash-outline" size={15} color={COLORS.negative} />
          </TouchableOpacity>
        )}
      </View>

      {expanded && (
        <View style={ir.expandedContent}>
          {/* Product / Service */}
          <View>
            <Text style={ir.fieldLabel}>Product / Service <Text style={ir.star}>*</Text></Text>
            <BottomSheetSearch
              placeholder="Select product..."
              options={stockOpts}
              value={item.product}
              onSelect={opt => onProductSelect(item.id, opt)}
              onClear={() => onProductClear(item.id)}
              sheetTitle="Product / Service"
              containerStyle={{ marginBottom: 0 }}
            />
          </View>

          {/* Godown — only shown when product is selected */}
          {item.product && needsWarehouseDropdown ? (
            <View>
              <Text style={ir.fieldLabel}>Godown / Warehouse <Text style={ir.star}>*</Text></Text>
              <BottomSheetSearch
                placeholder="Select godown..."
                options={warehouseOpts}
                value={item.warehouse}
                onSelect={opt => onUpdate(item.id, 'warehouse', opt.value)}
                onClear={() => onUpdate(item.id, 'warehouse', '')}
                sheetTitle="Godown / Warehouse"
                containerStyle={{ marginBottom: 0 }}
              />
            </View>
          ) : null}

          {/* Row: Qty | Unit | Rate */}
          <View style={ir.qurRow}>
            <View style={ir.qtyBox}>
              <Text style={ir.miniLabel}>Qty <Text style={ir.star}>*</Text></Text>
              <TextInput
                style={[ir.miniInput, { textAlign: 'center' }]}
                value={item.qty}
                onChangeText={v => onUpdate(item.id, 'qty', v)}
                keyboardType="numeric"
                selectTextOnFocus
                placeholder="1"
                placeholderTextColor={COLORS.textTertiary}
              />
            </View>
            <View style={ir.unitBox}>
              <Text style={ir.miniLabel}>Unit</Text>
              <TouchableOpacity style={ir.unitBtn} disabled activeOpacity={1}>
                <Text style={ir.unitTxt}>{item.unit || '—'}</Text>
              </TouchableOpacity>
            </View>
            <View style={ir.rateBox}>
              <Text style={ir.miniLabel}>Rate (₹) <Text style={ir.star}>*</Text></Text>
              <TextInput
                style={[ir.miniInput, { textAlign: 'right' }]}
                value={item.rate}
                onChangeText={v => onUpdate(item.id, 'rate', v)}
                keyboardType="numeric"
                selectTextOnFocus
                placeholder="0.00"
                placeholderTextColor={COLORS.textTertiary}
              />
            </View>
          </View>

          {/* Amount — derived, never hand-edited */}
          <View style={ir.taxableRow}>
            <Text style={ir.taxableLabel}>Amount</Text>
            <Text style={ir.taxableVal}>₹{calc.amount.toFixed(2)}</Text>
          </View>

          {/* Sales Ledger — defaults to the ledger picked in step 1 */}
          <View>
            <Text style={ir.fieldLabel}>Sales Ledger <Text style={ir.star}>*</Text></Text>
            <BottomSheetSearch
              placeholder="Select sales ledger..."
              options={salesLedgers.map(l => ({ label: l.name, value: l.name }))}
              value={item.salesLedger}
              onSelect={opt => onUpdate(item.id, 'salesLedger', opt.value)}
              onClear={() => onUpdate(item.id, 'salesLedger', '')}
              sheetTitle="Sales Ledger"
              containerStyle={{ marginBottom: 0 }}
            />
          </View>

          {/* Tax Section */}
          <View style={ir.taxSection}>
            <View style={ir.taxSectionHdr}>
              <Text style={ir.taxSectionTitle}>Taxes</Text>
              <Text style={ir.taxColHint}>Type · Rate % · Amount ₹</Text>
            </View>
            {item.taxEntries.map(te => (
              <TaxEntryRow
                key={te.id}
                entry={te}
                taxLedgers={taxLedgers}
                taxable={calc.amount}
                onUpdate={(field, val) => onUpdateTaxEntry(item.id, te.id, field, val)}
                onRemove={() => onRemoveTaxEntry(item.id, te.id)}
              />
            ))}
            <TouchableOpacity style={ir.addTaxDashedBtn} onPress={() => onAddTaxEntry(item.id)} activeOpacity={0.7}>
              <Ionicons name="add-circle-outline" size={15} color={COLORS.brandPrimary} />
              <Text style={ir.addTaxDashedTxt}>Add Tax</Text>
            </TouchableOpacity>
          </View>

          <View style={ir.subtotalRow}>
            <Text style={ir.subtotalLabel}>Item Total</Text>
            <Text style={ir.subtotalVal}>₹{calc.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function CreateDeliveryNoteScreen() {
  const router = useRouter();
  const scrollRef = useRef<any>(null);
  const notesCardY = useRef<number>(0);
  const narrationOffset = useRef<number>(0);
  const scrollToFieldY = (fieldOffset: number) => {
    setTimeout(() => {
      const absY = notesCardY.current + fieldOffset;
      scrollRef.current?.scrollTo?.({ y: Math.max(0, absY - 100), animated: true });
    }, 250);
  };
  const insets = useSafeAreaInsets();
  const { company, selectedFY, isPaired } = useAuth();
  const fyStart = selectedFY?.startDate || `${new Date().getFullYear()}-04-01`;
  const fyEnd = selectedFY?.endDate || `${new Date().getFullYear() + 1}-03-31`;

  // ── Core state ───────────────────────────────────────────────────────────────
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [entryType, setEntryType] = useState<EntryType>('regular');
  const [date, setDate] = useState(todayStr());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [ledger, setLedger] = useState('');
  const [party, setParty] = useState('');
  const [partyGstin, setPartyGstin] = useState('');
  const [partyGstRegType, setPartyGstRegType] = useState('');
  const [parties, setParties] = useState<BSSOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingOrderItems, setLoadingOrderItems] = useState(false);

  // Linked Sales Order — fetched only once a party is chosen
  const [linkedOrderOpts, setLinkedOrderOpts] = useState<BSSOption[]>([]);
  const [linkedOrdersLoading, setLinkedOrdersLoading] = useState(false);
  const [linkedOrder, setLinkedOrder] = useState<LinkedOrder | null>(null);

  // Live masters
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [salesLedgers, setSalesLedgers] = useState<{ name: string; guid?: string }[]>([]);
  const [taxLedgers, setTaxLedgers] = useState<{ name: string }[]>([]);
  const [chargeLedgers, setChargeLedgers] = useState<{ ledgerName: string; guid?: string }[]>([]);
  const [roundOffLedgers, setRoundOffLedgers] = useState<{ ledgerName: string; guid?: string }[]>([]);

  // Per-item godowns (fetched when product selected)
  const [itemGodowns, setItemGodowns] = useState<Record<string, Godown[]>>({});

  const [items, setItems] = useState<DNItem[]>([newItem()]);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [roundOffLedger, setRoundOffLedger] = useState('');
  const [roundOffAmount, setRoundOffAmount] = useState('');
  const [narration, setNarration] = useState('');

  // Step 2 — Order Details
  const [modeOfPayment, setModeOfPayment] = useState('');
  const [otherReferences, setOtherReferences] = useState('');
  const [termsOfDelivery, setTermsOfDelivery] = useState('');

  // Step 2 — Dispatch Details
  const [dispatchDocNo, setDispatchDocNo] = useState('');
  const [dispatchedThrough, setDispatchedThrough] = useState('');
  const [shipToDestination, setShipToDestination] = useState('');
  const [carrierName, setCarrierName] = useState('');
  const [billOfLadingNo, setBillOfLadingNo] = useState('');
  const [lrDate, setLrDate] = useState('');
  const [showLrDatePicker, setShowLrDatePicker] = useState(false);
  const [vehicleNumber, setVehicleNumber] = useState('');
  // Internal tracking for later DN→Invoice (not on screenshot)
  const [trackingNumber, setTrackingNumber] = useState('');

  // Success
  const [showSuccess, setShowSuccess] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    tdkRef: string; isQueued: boolean; message: string; voucherNumber?: string;
  } | null>(null);

  // Universal numbering — Settings → Voucher Config only (no on-screen override)
  const { numberingPolicy } = useNumberingPolicy(company?.guid);
  const numberingDisplay = numberingPolicy === 'tallydekho_series'
    ? 'Auto · TallyDekho series'
    : 'Auto · Tally series';

  const handleEntryTypeChange = useCallback((next: EntryType) => {
    setEntryType(next);
    if (next === 'regular') setDate(todayStr());
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo?.({ y: 0, animated: false });
  }, [step]);

  // ── Data loading ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!company?.guid) return;
    getParties(company.guid).then((res: any) => {
      const list = res?.data || [];
      if (list.length > 0) setParties(list.map((p: any) => ({
        label: p.name,
        value: p.name,
        subtitle: p.gstin ? `GSTIN: ${p.gstin}` : undefined,
        data: {
          gstin: p.gstin || '',
          gst_registration_type: p.gst_registration_type || '',
          guid: p.guid || '',
          address: p.address || '',
          state_name: p.state_name || '',
          pincode: p.pincode || '',
        },
      })));
    }).catch(() => {});
  }, [company?.guid]);

  useEffect(() => {
    if (!company?.guid) return;
    getStocks(company.guid, { limit: 2000 }).then((res: any) => {
      const list = res?.data?.items || res?.items || res?.data || [];
      setStockItems(Array.isArray(list) ? list : []);
    }).catch(() => {});
  }, [company?.guid]);

  useEffect(() => {
    if (!company?.guid) return;
    getWarehouses(company.guid).then((res: any) => {
      const list: Warehouse[] = res?.data || res?.warehouses || [];
      setWarehouses(list);
      if (list.length === 1) setItems(prev => prev.map(i => ({ ...i, warehouse: list[0].name })));
    }).catch(() => {});
  }, [company?.guid]);

  useEffect(() => {
    if (!company?.guid) return;
    getSalesLedgerAccounts(company.guid).then((res: any) => {
      const list = res?.data || [];
      setSalesLedgers(list);
      if (list.length > 0) {
        setLedger(prev => prev || list[0].name);
        setItems(prev => prev.map(i => (i.salesLedger ? i : { ...i, salesLedger: list[0].name })));
      }
    }).catch(() => {});
  }, [company?.guid]);

  useEffect(() => {
    if (!company?.guid) return;
    getTaxLedgers(company.guid).then((res: any) => {
      setTaxLedgers(res?.data || []);
    }).catch(() => {});
  }, [company?.guid]);

  useEffect(() => {
    if (!company?.guid) return;
    getChargeLedgers(company.guid).then((res: any) => {
      const d = res?.data;
      if (d) {
        setChargeLedgers([...(d.logisticsCharges || []), ...(d.additionalCharges || [])]);
        setRoundOffLedgers(d.roundOffLedgers || []);
      }
    }).catch(() => {});
  }, [company?.guid]);

  // Linked Sales Orders — only fetched after a party is selected. The backend
  // applies an exact, case-insensitive partyName filter.
  useEffect(() => {
    if (!company?.guid || !party) {
      setLinkedOrderOpts([]);
      setLinkedOrdersLoading(false);
      return;
    }
    let cancelled = false;
    setLinkedOrdersLoading(true);
    getSalesOrders(company.guid, {
      partyName: party,
      limit: '50',
      from: selectedFY?.startDate,
      to: selectedFY?.endDate,
    })
      .then((res: any) => {
        if (cancelled) return;
        const rows: any[] = Array.isArray(res?.data) ? res.data : [];
        setLinkedOrderOpts(
          rows
            .filter(r => r.voucher_number)
            .map(r => ({
              label: String(r.voucher_number),
              value: String(r.voucher_number),
              subtitle: [isoToDMY(r.date), r.amount != null ? `₹${Math.abs(Number(r.amount) || 0).toLocaleString('en-IN')}` : '']
                .filter(Boolean).join(' · '),
              data: {
                date: toISODate(r.date),
                guid: r.guid || '',
                tdkRef: r.tdk_reference_no || '',
              },
            }))
        );
      })
      .catch(() => { if (!cancelled) setLinkedOrderOpts([]); })
      .finally(() => { if (!cancelled) setLinkedOrdersLoading(false); });
    return () => { cancelled = true; };
  }, [company?.guid, party, selectedFY?.startDate, selectedFY?.endDate]);

  // ── Item actions ─────────────────────────────────────────────────────────────
  const updateItem = useCallback((id: string, field: keyof DNItem, val: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: val as any } : i));
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.length > 1 ? prev.filter(i => i.id !== id) : prev);
    setItemGodowns(prev => { const n = { ...prev }; delete n[id]; return n; });
  }, []);

  const addItem = useCallback(() => {
    const autoWarehouse = warehouses.length === 1 ? warehouses[0].name : '';
    setItems(prev => [...prev, newItem(ledger, autoWarehouse)]);
  }, [warehouses, ledger]);

  const handleProductSelect = useCallback(async (itemId: string, opt: BSSOption) => {
    const si2 = stockItems.find(st => st.name === opt.value);
    setItems(prev => prev.map(i => i.id === itemId ? {
      ...i,
      product: opt.value,
      unit: si2?.unit || '',
      rate: si2?.rate != null ? String(si2.rate) : i.rate,
      salesLedger: i.salesLedger || ledger,
      warehouse: '',
    } : i));
    if (!si2 || !company?.guid) {
      if (warehouses.length === 1) updateItem(itemId, 'warehouse', warehouses[0].name);
      return;
    }
    try {
      const res: any = await getStockGodowns(company.guid, si2.guid || '');
      const godownList: Godown[] = res?.data?.warehouses || [];
      const finalGodowns: Godown[] = godownList.length > 0
        ? godownList
        : [{ name: 'Main Location', qty: si2.closing_qty ?? 0 }];
      setItemGodowns(prev => ({ ...prev, [itemId]: finalGodowns }));
      if (finalGodowns.length === 1) {
        setItems(prev => prev.map(i => i.id === itemId ? { ...i, warehouse: finalGodowns[0].name } : i));
      }
    } catch {
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, warehouse: 'Main Location' } : i));
    }
  }, [stockItems, company?.guid, warehouses, updateItem, ledger]);

  const handleProductClear = useCallback((itemId: string) => {
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, product: '', unit: '', rate: '', warehouse: '' } : i));
    setItemGodowns(prev => { const n = { ...prev }; delete n[itemId]; return n; });
  }, []);

  const addTaxEntry = useCallback((itemId: string) => {
    setItems(prev => prev.map(i => i.id === itemId ? {
      ...i,
      taxEntries: [...i.taxEntries, {
        id: Date.now().toString() + Math.random().toString(36).slice(2),
        ledgerName: '', taxRate: '', taxAmount: '',
      }],
    } : i));
  }, []);

  const updateTaxEntry = useCallback((itemId: string, entryId: string, field: keyof TaxLedgerEntry, val: string) => {
    setItems(prev => prev.map(i => i.id === itemId ? {
      ...i,
      taxEntries: i.taxEntries.map(t => t.id === entryId ? { ...t, [field]: val } : t),
    } : i));
  }, []);

  const removeTaxEntry = useCallback((itemId: string, entryId: string) => {
    setItems(prev => prev.map(i => i.id === itemId ? {
      ...i, taxEntries: i.taxEntries.filter(t => t.id !== entryId),
    } : i));
  }, []);

  // ── Party change clears the linked Sales Order + SO-prefilled items ───────────
  const resetItemsBlank = useCallback(() => {
    const autoWarehouse = warehouses.length === 1 ? warehouses[0].name : '';
    setItems([newItem(ledger, autoWarehouse)]);
    setItemGodowns({});
  }, [warehouses, ledger]);

  const handlePartySelect = useCallback((opt: BSSOption) => {
    setParty(opt.value);
    setPartyGstin(opt.data?.gstin || '');
    setPartyGstRegType(opt.data?.gst_registration_type || '');
    setLinkedOrder(null);
    setLinkedOrderOpts([]);
    setTrackingNumber('');
    resetItemsBlank();
  }, [resetItemsBlank]);

  const handlePartyClear = useCallback(() => {
    setParty('');
    setPartyGstin('');
    setPartyGstRegType('');
    setLinkedOrder(null);
    setLinkedOrderOpts([]);
    setTrackingNumber('');
    resetItemsBlank();
  }, [resetItemsBlank]);

  /** Prefill Step 3 from linked Sales Order — voucher_inventory_items, with optional app_vouchers snapshot for taxes. */
  const applyOrderPrefill = useCallback(async (order: LinkedOrder) => {
    if (!company?.guid) return;
    setLoadingOrderItems(true);
    try {
      let mapped: DNItem[] = [];
      let logisticsFromPayload: LogEntry[] = [];

      // Prefer app_vouchers snapshot when TDK-created SO exists (richer tax/logistics).
      if (order.tdkRef) {
        try {
          const preview: any = await getOrderPreview(order.tdkRef, company.guid);
          const doc = preview?.data || preview || {};
          const raw = doc.rawPayload || {};
          const rawItems = Array.isArray(raw.items) ? raw.items : [];
          if (rawItems.length) {
            mapped = rawItems.map((it: any) => ({
              id: Date.now().toString() + Math.random().toString(36).slice(2),
              warehouse: it.godown || it.warehouse || (warehouses.length === 1 ? warehouses[0].name : ''),
              product: it.itemName || it.product || it.name || '',
              qty: String(it.billedQty ?? it.actualQty ?? it.qty ?? 1),
              unit: it.unit || '',
              rate: String(it.rate ?? 0),
              salesLedger: it.salesLedger || ledger,
              taxEntries: Array.isArray(it.taxEntries)
                ? it.taxEntries.map((t: any) => ({
                  id: Date.now().toString() + Math.random().toString(36).slice(2),
                  ledgerName: t.ledgerName || '',
                  taxRate: String(t.taxRate ?? ''),
                  taxAmount: String(t.taxAmount ?? ''),
                }))
                : [],
            }));
            // Attach voucher-level taxes to first line when per-item taxEntries absent
            if (mapped[0] && (!mapped[0].taxEntries || mapped[0].taxEntries.length === 0)
                && Array.isArray(raw.taxes) && raw.taxes.length) {
              mapped[0] = {
                ...mapped[0],
                taxEntries: raw.taxes.map((t: any) => ({
                  id: Date.now().toString() + Math.random().toString(36).slice(2),
                  ledgerName: t.ledgerName || '',
                  taxRate: String(t.taxRate ?? ''),
                  taxAmount: String(t.taxAmount ?? ''),
                })),
              };
            }
            if (Array.isArray(raw.logistics) && raw.logistics.length) {
              logisticsFromPayload = raw.logistics.map((lg: any) => ({
                id: Date.now().toString() + Math.random().toString(36).slice(2),
                ledgerName: lg.ledgerName || '',
                amount: String(lg.amount ?? ''),
                addTaxes: Array.isArray(lg.taxes) && lg.taxes.length > 0,
                taxEntries: (lg.taxes || []).map((t: any) => ({
                  id: Date.now().toString() + Math.random().toString(36).slice(2),
                  ledgerName: t.ledgerName || '',
                  taxRate: String(t.taxRate ?? ''),
                  taxAmount: String(t.taxAmount ?? ''),
                })),
              }));
            }
          }
        } catch { /* fall through to voucher inventory */ }
      }

      // Synced Tally SO (or preview miss) — pull inventory lines by guid / voucher number
      if (!mapped.length) {
        const res: any = await getVoucherById(company.guid, order.guid || order.voucherNumber);
        const invItems: any[] = res?.data?.items || [];
        mapped = invItems
          .filter(it => it.stock_item_name)
          .map(it => ({
            id: Date.now().toString() + Math.random().toString(36).slice(2),
            warehouse: it.godown_name || (warehouses.length === 1 ? warehouses[0].name : ''),
            product: it.stock_item_name || '',
            qty: String(it.billed_qty ?? it.actual_qty ?? 1),
            unit: it.unit || '',
            rate: String(it.rate ?? 0),
            salesLedger: ledger,
            taxEntries: [],
          }));
      }

      if (mapped.length) {
        setItems(mapped);
        setItemGodowns({});
        // Warm godown lists for prefilled products (non-blocking)
        mapped.forEach(async (row) => {
          const si2 = stockItems.find(st => st.name === row.product);
          if (!si2?.guid || !company?.guid) return;
          try {
            const gRes: any = await getStockGodowns(company.guid, si2.guid);
            const godownList: Godown[] = gRes?.data?.warehouses || [];
            const finalGodowns: Godown[] = godownList.length > 0
              ? godownList
              : [{ name: row.warehouse || 'Main Location', qty: si2.closing_qty ?? 0 }];
            setItemGodowns(prev => ({ ...prev, [row.id]: finalGodowns }));
            if (!row.warehouse && finalGodowns.length === 1) {
              setItems(prev => prev.map(i => i.id === row.id ? { ...i, warehouse: finalGodowns[0].name } : i));
            }
          } catch { /* leave warehouse editable */ }
        });
        if (logisticsFromPayload.length) setLogEntries(logisticsFromPayload);
        Toast.show({ type: 'success', text1: 'Sales Order loaded', text2: `${mapped.length} item${mapped.length === 1 ? '' : 's'} ready in Step 3` });
      } else {
        Toast.show({ type: 'info', text1: 'Order linked', text2: 'No line items found — add them in Step 3' });
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Could not load order items', text2: err?.message || 'Add items manually in Step 3' });
    } finally {
      setLoadingOrderItems(false);
    }
  }, [company?.guid, ledger, warehouses, stockItems]);

  const handleLinkedOrderSelect = useCallback((opt: BSSOption) => {
    const order: LinkedOrder = {
      voucherNumber: opt.value,
      date: opt.data?.date || '',
      guid: opt.data?.guid || '',
      tdkRef: opt.data?.tdkRef || '',
    };
    setLinkedOrder(order);
    setTrackingNumber(prev => prev || opt.value);
    applyOrderPrefill(order);
  }, [applyOrderPrefill]);

  const handleLinkedOrderClear = useCallback(() => {
    setLinkedOrder(null);
    setTrackingNumber('');
    resetItemsBlank();
    setLogEntries([]);
  }, [resetItemsBlank]);

  // ── Navigation ───────────────────────────────────────────────────────────────
  const goNext = useCallback(() => {
    if (step === 1) {
      if (!ledger) { Toast.show({ type: 'error', text1: 'Sales Ledger required' }); return; }
      if (!party) { Toast.show({ type: 'error', text1: 'Customer / Party required' }); return; }
      if (!date) { Toast.show({ type: 'error', text1: 'Date required' }); return; }
      setStep(2);
      return;
    }
    if (step === 2) {
      setStep(3);
    }
  }, [step, ledger, party, date]);

  const goBack = useCallback(() => {
    if (step === 3) setStep(2);
    else if (step === 2) setStep(1);
  }, [step]);

  // ── Computed ─────────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    let gross = 0, taxTotal = 0;
    items.forEach(item => {
      const c = calcItem(item);
      gross += c.amount; taxTotal += c.taxAmt;
    });
    const chargesOnly = calcLogisticsTotal(logEntries, 0);
    const roundOff = parseFloat(roundOffAmount) || 0;
    return { gross, taxTotal, logisticsTotal: chargesOnly, roundOff, grand: gross + taxTotal + chargesOnly + roundOff };
  }, [items, logEntries, roundOffAmount]);

  const itemsSummary = useMemo(() => {
    const filled = items.filter(i => i.product);
    if (filled.length === 0) return `${items.length} item${items.length !== 1 ? 's' : ''} (not filled)`;
    const first = stockItems.find(si2 => si2.name === filled[0].product);
    const firstName = first?.displayName || filled[0].product;
    if (filled.length === 1) return firstName;
    return `${firstName} + ${filled.length - 1} more`;
  }, [items, stockItems]);

  // ── Submit ────────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    Keyboard.dismiss();
    if (!isPaired) { Toast.show({ type: 'error', text1: 'Not Paired', text2: 'Pair with Tally Desktop before creating a delivery note.' }); return; }
    if (!company?.guid) { Toast.show({ type: 'error', text1: 'No company selected' }); return; }
    if (!ledger) { Toast.show({ type: 'error', text1: 'Sales Ledger required' }); return; }
    if (!party) { Toast.show({ type: 'error', text1: 'Customer required' }); return; }
    if (!date) { Toast.show({ type: 'error', text1: 'Date required' }); return; }

    const filledItems = items.filter(i => i.product && (parseFloat(i.qty) || 0) > 0 && (parseFloat(i.rate) || 0) > 0);
    if (filledItems.length === 0) { Toast.show({ type: 'error', text1: 'Add at least 1 item with qty and rate' }); return; }
    if (items.some(i => i.product && (!(parseFloat(i.qty) > 0) || !(parseFloat(i.rate) > 0)))) {
      Toast.show({ type: 'error', text1: 'All items need qty and rate' }); return;
    }
    if (items.some(i => i.product && !i.salesLedger)) {
      Toast.show({ type: 'error', text1: 'Select a sales ledger for every item' }); return;
    }
    const multiGodownItems = items.filter(i => i.product && (itemGodowns[i.id]?.length || 0) > 1);
    if (multiGodownItems.some(i => !i.warehouse)) {
      Toast.show({ type: 'error', text1: 'Select godown for all items' }); return;
    }
    if (vehicleNumber.trim() && !/^[A-Z0-9-]{6,15}$/.test(vehicleNumber.trim())) {
      Toast.show({ type: 'error', text1: 'Invalid vehicle number', text2: 'Use letters/digits only, e.g. MH12AB1234' }); return;
    }

    setSubmitting(true);
    try {
      const allLogistics = [
        ...logEntries.map(e => ({
          ledgerName: e.ledgerName,
          amount: parseFloat(e.amount) || 0,
          taxes: e.addTaxes ? e.taxEntries.map(t => ({
            ledgerName: t.ledgerName,
            taxRate: parseFloat(t.taxRate),
            taxAmount: parseFloat(t.taxAmount) || 0,
          })) : [],
        })),
        ...(roundOffLedger && roundOffAmount
          ? [{ ledgerName: roundOffLedger, amount: parseFloat(roundOffAmount) || 0, taxes: [] }]
          : []),
      ];

      const hasDispatch = !!(
        modeOfPayment || otherReferences || termsOfDelivery
        || dispatchDocNo || dispatchedThrough || shipToDestination
        || carrierName || billOfLadingNo || lrDate || vehicleNumber
      );

      const result: any = await createDeliveryNote({
        companyGuid: company.guid,
        companyName: company.name,
        partyLedger: party,
        date: dmyToISO(date),
        totalAmount: totals.grand,
        items: filledItems.map(item => ({
          itemName: item.product,
          actualQty: parseFloat(item.qty) || 0,
          billedQty: parseFloat(item.qty) || 0,
          unit: item.unit,
          rate: parseFloat(item.rate) || 0,
          amount: calcItem(item).amount,
          salesLedger: item.salesLedger || ledger,
          godown: item.warehouse || warehouses[0]?.name || 'Main Location',
          trackingNumber: trackingNumber || linkedOrder?.voucherNumber || '',
        })),
        taxes: filledItems.flatMap(item => {
          const taxable = calcItem(item).amount;
          return (item.taxEntries || [])
            .filter(t => t.ledgerName && (parseFloat(t.taxRate) > 0 || parseFloat(t.taxAmount) > 0))
            .map(t => {
              const override = parseFloat(t.taxAmount);
              const taxAmt = !isNaN(override) && t.taxAmount.trim() !== ''
                ? override
                : taxable * (parseFloat(t.taxRate) || 0) / 100;
              return { ledgerName: t.ledgerName, taxRate: parseFloat(t.taxRate), taxAmount: taxAmt, taxableValue: taxable };
            });
        }),
        logistics: allLogistics,
        narration: narration || undefined,
        isOptional: entryType === 'optional',
        original_entry_type: entryType,
        numbering_policy: numberingPolicy,
        dispatch_details: hasDispatch ? {
          mode_of_payment: modeOfPayment || undefined,
          other_references: otherReferences || undefined,
          terms_of_delivery: termsOfDelivery || undefined,
          transport_doc_no: dispatchDocNo || undefined,
          dispatched_through: dispatchedThrough || undefined,
          ship_to: shipToDestination || undefined,
          carrier_name: carrierName || undefined,
          bill_of_lading_no: billOfLadingNo || undefined,
          lr_date: lrDate ? dmyToISO(lrDate) : undefined,
          vehicle_number: vehicleNumber || undefined,
        } : undefined,
        linked_order: linkedOrder
          ? { order_no: linkedOrder.voucherNumber, order_date: linkedOrder.date }
          : undefined,
      });

      const tdkRef = result?.data?.tdkReferenceNo || result?.tdkReferenceNo || '';
      const isQueued = result?.queued === true;
      const voucherNumber = result?.voucherNumber || result?.data?.voucherNumber || undefined;
      setSubmitResult({ tdkRef, isQueued, message: result?.message || '', voucherNumber });
      setShowSuccess(true);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Submit Failed', text2: err?.message || 'Check Tally connection.' });
    } finally {
      setSubmitting(false);
    }
  }, [
    company, isPaired, ledger, party, date, items, itemGodowns, totals.grand, warehouses,
    logEntries, roundOffLedger, roundOffAmount, narration, entryType, numberingPolicy,
    modeOfPayment, otherReferences, termsOfDelivery, dispatchDocNo, dispatchedThrough,
    shipToDestination, carrierName, billOfLadingNo, lrDate, vehicleNumber, trackingNumber, linkedOrder,
  ]);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Success Overlay */}
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
            <Text style={ss.title}>{submitResult.isQueued ? 'Saved. Pending Sync' : 'Delivery Note Submitted!'}</Text>
            <Text style={ss.sub}>
              {submitResult.isQueued
                ? 'Entry queued. Will push to Tally when desktop reconnects.'
                : 'Delivery note pushed to Tally successfully.'}
            </Text>
            <View style={[ss.refBadge, submitResult.voucherNumber ? { backgroundColor: '#F0FDF4', borderColor: '#22C55E44' } : null]}>
              <Text style={ss.refLabel}>Delivery Note No.</Text>
              <Text style={[ss.refVal, submitResult.voucherNumber ? { color: '#166534' } : { color: COLORS.textSecondary }]}>
                {submitResult.voucherNumber || 'Pending from TallyPrime'}
              </Text>
            </View>
            {!!submitResult.tdkRef && (
              <View style={ss.refBadge}>
                <Text style={ss.refLabel}>Reference No.</Text>
                <Text style={ss.refVal}>{submitResult.tdkRef}</Text>
              </View>
            )}

            {/* Generic voucher preview — use the real submit values, never a fake DN number. */}
            {!!submitResult.tdkRef && (
              <TouchableOpacity
                style={ss.previewBtn}
                activeOpacity={0.85}
                onPress={() => {
                  const filled = items.filter(i => i.product);
                  const deliveryItems = filled.map((i, idx) => ({
                    no: String(idx + 1),
                    item: i.product,
                    qty: i.unit ? `${i.qty} ${i.unit}` : i.qty,
                  }));
                  // Quantities are summed per unit — mixed-unit deliveries must not be
                  // collapsed into a single meaningless number.
                  const qtyByUnit = filled.reduce<Record<string, number>>((acc, i) => {
                    const u = i.unit || 'Unit unspecified';
                    acc[u] = (acc[u] || 0) + (parseFloat(i.qty) || 0);
                    return acc;
                  }, {});
                  router.push({
                    pathname: '/voucher/preview',
                    params: {
                      type: 'delivery_note',
                      voucherNumber: submitResult.voucherNumber || submitResult.tdkRef,
                      date,
                      party,
                      customer: party,
                      amount: String(totals.grand),
                      narration,
                      totalQty: Object.entries(qtyByUnit).map(([u, q]) => `${q} ${u}`).join(' · '),
                      ...(shipToDestination || dispatchedThrough || vehicleNumber || billOfLadingNo ? {
                        shipTo: shipToDestination,
                        dispatchMode: dispatchedThrough,
                        vehicleLR: [vehicleNumber, billOfLadingNo || dispatchDocNo].filter(Boolean).join(' / '),
                      } : {}),
                      ...(linkedOrder ? { againstSO: linkedOrder.voucherNumber } : {}),
                      deliveryItems: JSON.stringify(deliveryItems),
                    },
                  } as any);
                }}
              >
                <Ionicons name="eye-outline" size={18} color={COLORS.brandPrimary} />
                <Text style={ss.previewBtnTxt}>Preview</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={ss.doneBtn} activeOpacity={0.85} onPress={() => { setShowSuccess(false); router.back(); }}>
              <Text style={ss.doneTxt}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={step === 1 ? () => router.back() : goBack} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Delivery Note</Text>
          <Text style={s.headerSub}>{numberingDisplay}</Text>
        </View>
        <RegularOptionalToggle value={entryType} onChange={handleEntryTypeChange} />
      </View>

      <StepIndicator step={step} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'android' ? 120 : 0}>
        <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" onScrollBeginDrag={Keyboard.dismiss}>

          {/* ═══════════ STEP 1: Details ═══════════ */}
          {step === 1 && (
            <>
              <BottomSheetSearch
                label="Sales Ledger" required
                placeholder="Search ledger account..."
                options={salesLedgers.map(l => ({ label: l.name, value: l.name }))}
                value={ledger}
                onSelect={opt => {
                  setLedger(opt.value);
                  setItems(prev => prev.map(i => (i.salesLedger ? i : { ...i, salesLedger: opt.value })));
                }}
                onClear={() => setLedger('')}
                sheetTitle="Sales Ledger"
                icon="book-outline"
              />

              <View style={s.card}>
                <View style={s.cardHdr}>
                  <Ionicons name="document-text-outline" size={18} color={COLORS.brandPrimary} />
                  <Text style={s.cardTitle}>Delivery Note Details</Text>
                </View>
                <View style={s.row2}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fLabel}>DN No.</Text>
                    <View style={s.autoBox}>
                      <Text style={s.autoTxt} numberOfLines={1}>{numberingDisplay}</Text>
                      <Ionicons name="lock-closed-outline" size={13} color={COLORS.textTertiary} />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fLabel}>Date <Text style={s.star}>*</Text></Text>
                    {entryType === 'regular' ? (
                      <View style={[s.autoBox, { opacity: 0.55 }]}>
                        <Text style={s.autoTxt}>{date}</Text>
                        <Ionicons name="lock-closed-outline" size={13} color={COLORS.textTertiary} />
                      </View>
                    ) : (
                      <TouchableOpacity style={s.fInput} onPress={() => setShowDatePicker(true)}>
                        <Text style={{ color: date ? COLORS.textPrimary : COLORS.textTertiary }}>{date || 'Select date'}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                <Text style={s.helperTxt}>
                  Voucher number is assigned per Settings → Voucher Config. This screen never invents one.
                </Text>
              </View>

              <BottomSheetSearch
                label="Customer / Party" required
                placeholder="Search customer..."
                options={parties}
                value={party}
                onSelect={handlePartySelect}
                onClear={handlePartyClear}
                sheetTitle="Customer / Party"
                icon="person-outline"
              />
              {party && partyGstin ? (
                <View style={s.gstRow}>
                  <Ionicons name="shield-checkmark-outline" size={13} color={COLORS.positive} />
                  <Text style={s.gstTxt}>{partyGstin}</Text>
                  {partyGstRegType ? <Text style={s.gstSubTxt}>· {partyGstRegType}</Text> : null}
                </View>
              ) : party && !partyGstin ? (
                <View style={s.gstRow}>
                  <Ionicons name="alert-circle-outline" size={13} color={COLORS.textTertiary} />
                  <Text style={s.gstSubTxt}>No GSTIN registered</Text>
                </View>
              ) : null}

              {/* Linked Sales Order — loaded only once a party is chosen */}
              {party ? (
                <View style={{ marginTop: SPACING.md }}>
                  <BottomSheetSearch
                    label="Linked Sales Order"
                    placeholder={
                      linkedOrdersLoading
                        ? 'Loading orders...'
                        : linkedOrderOpts.length === 0
                          ? 'No sales orders for this party'
                          : 'Select sales order...'
                    }
                    options={linkedOrderOpts}
                    value={linkedOrder?.voucherNumber || ''}
                    onSelect={handleLinkedOrderSelect}
                    onClear={handleLinkedOrderClear}
                    sheetTitle="Linked Sales Order"
                    icon="link-outline"
                    disabled={linkedOrdersLoading || linkedOrderOpts.length === 0}
                  />
                  {(linkedOrdersLoading || loadingOrderItems) && (
                    <View style={s.gstRow}>
                      <ActivityIndicator size="small" color={COLORS.brandPrimary} />
                      <Text style={s.gstSubTxt}>
                        {loadingOrderItems
                          ? `Loading items from order #${linkedOrder?.voucherNumber || ''}...`
                          : `Fetching sales orders for ${party}...`}
                      </Text>
                    </View>
                  )}
                  {linkedOrder && !loadingOrderItems && (
                    <Text style={s.helperTxt}>
                      Order #{linkedOrder.voucherNumber} linked — items prefilled for Step 3 (qty editable for partial delivery).
                    </Text>
                  )}
                </View>
              ) : (
                <Text style={s.helperTxt}>Select a customer to load their sales orders.</Text>
              )}
            </>
          )}

          {/* ═══════════ STEP 2: Order & Dispatch ═══════════ */}
          {step === 2 && (
            <>
              <View style={s.card}>
                <View style={s.cardHdr}>
                  <Ionicons name="receipt-outline" size={18} color={COLORS.brandPrimary} />
                  <Text style={s.cardTitle}>Order Details</Text>
                </View>
                <Text style={s.fLabel}>Order No(s)</Text>
                <View style={[s.autoBox, { marginBottom: SPACING.md }]}>
                  <Text style={s.autoTxt} numberOfLines={1}>
                    {linkedOrder?.voucherNumber
                      ? `#${linkedOrder.voucherNumber}${linkedOrder.date ? ` · ${isoToDMY(linkedOrder.date)}` : ''}`
                      : 'No linked sales order'}
                  </Text>
                  <Ionicons name="lock-closed-outline" size={13} color={COLORS.textTertiary} />
                </View>
                <Text style={s.fLabel}>Mode/Terms of Payment</Text>
                <ThemedFInput
                  value={modeOfPayment}
                  onChangeText={setModeOfPayment}
                  placeholder="e.g. Against Delivery / 30 Days"
                  style={{ marginBottom: SPACING.md }}
                />
                <Text style={s.fLabel}>Other References</Text>
                <ThemedFInput
                  value={otherReferences}
                  onChangeText={setOtherReferences}
                  placeholder="Customer PO / other ref"
                  style={{ marginBottom: SPACING.md }}
                />
                <Text style={s.fLabel}>Terms of Delivery</Text>
                <ThemedFInput
                  value={termsOfDelivery}
                  onChangeText={setTermsOfDelivery}
                  placeholder="e.g. FOR Destination"
                  multiline
                  numberOfLines={2}
                  style={{ minHeight: 60, textAlignVertical: 'top', marginBottom: 0 }}
                />
              </View>

              <View style={s.card}>
                <View style={s.cardHdr}>
                  <Ionicons name="car-outline" size={18} color={COLORS.brandPrimary} />
                  <Text style={s.cardTitle}>Dispatch Details</Text>
                </View>
                <Text style={s.fLabel}>Dispatch Doc No.</Text>
                <ThemedFInput
                  value={dispatchDocNo}
                  onChangeText={setDispatchDocNo}
                  placeholder="Optional"
                  style={{ marginBottom: SPACING.md }}
                />
                <Text style={s.fLabel}>Dispatched through</Text>
                <ThemedFInput
                  value={dispatchedThrough}
                  onChangeText={setDispatchedThrough}
                  placeholder="e.g. Road / Courier name"
                  style={{ marginBottom: SPACING.md }}
                />
                <Text style={s.fLabel}>Destination</Text>
                <ThemedFInput
                  value={shipToDestination}
                  onChangeText={setShipToDestination}
                  placeholder="City / place of delivery"
                  style={{ marginBottom: SPACING.md }}
                />
                <Text style={s.fLabel}>Carrier Name/Agent</Text>
                <ThemedFInput
                  value={carrierName}
                  onChangeText={setCarrierName}
                  placeholder="Optional"
                  style={{ marginBottom: SPACING.md }}
                />
                <View style={s.row2}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fLabel}>Bill of Lading/LR-RR No.</Text>
                    <ThemedFInput value={billOfLadingNo} onChangeText={setBillOfLadingNo} placeholder="Optional" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fLabel}>LR Date</Text>
                    <TouchableOpacity
                      style={[s.fInput, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                      onPress={() => setShowLrDatePicker(true)}
                    >
                      <Text style={{ color: lrDate ? COLORS.textPrimary : COLORS.textTertiary, fontSize: TYPOGRAPHY.base }}>
                        {lrDate || 'Optional'}
                      </Text>
                      <Ionicons name="calendar-outline" size={14} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={s.fLabel}>Motor Vehicle No.</Text>
                <ThemedFInput
                  value={vehicleNumber}
                  onChangeText={v => setVehicleNumber(v.toUpperCase())}
                  placeholder="e.g. MH12AB1234"
                  autoCapitalize="characters"
                  maxLength={15}
                />
              </View>
            </>
          )}

          {/* ═══════════ STEP 3: Items & Logistics ═══════════ */}
          {step === 3 && (
            <>
              <View style={s.sectionHdr}>
                <Ionicons name="cube-outline" size={16} color={COLORS.textPrimary} />
                <Text style={s.sectionTitle}>Items to Deliver</Text>
                <View style={s.itemCount}><Text style={s.itemCountTxt}>{items.length}</Text></View>
                <Text style={s.sectionSummary} numberOfLines={1}>{itemsSummary}</Text>
              </View>

              {items.map((item, idx) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  itemIndex={idx}
                  canRemove={items.length > 1}
                  godowns={itemGodowns[item.id] || []}
                  onProductSelect={handleProductSelect}
                  onProductClear={handleProductClear}
                  onUpdate={updateItem}
                  onRemove={removeItem}
                  onAddTaxEntry={addTaxEntry}
                  onUpdateTaxEntry={updateTaxEntry}
                  onRemoveTaxEntry={removeTaxEntry}
                  stockItems={stockItems}
                  taxLedgers={taxLedgers}
                  salesLedgers={salesLedgers}
                />
              ))}

              <TouchableOpacity style={s.addItemBtn} onPress={addItem} activeOpacity={0.7}>
                <Ionicons name="add-circle-outline" size={18} color={COLORS.positive} />
                <Text style={s.addItemTxt}>+ Add Item</Text>
              </TouchableOpacity>

              <LogisticsSection
                entries={logEntries}
                onEntriesChange={setLogEntries}
                taxLedgers={taxLedgers}
                chargeLedgers={chargeLedgers}
                roundOffLedgers={roundOffLedgers}
                roundOffLedger={roundOffLedger}
                roundOffAmount={roundOffAmount}
                onRoundOffLedgerChange={setRoundOffLedger}
                onRoundOffAmountChange={setRoundOffAmount}
              />

              {/* Running total */}
              <View style={s.runningTotalCard}>
                <Text style={s.runTotalTitle}>Running Total</Text>
                <View style={s.runTotalRow}>
                  <Text style={s.runTotalLabel}>Items Subtotal</Text>
                  <Text style={s.runTotalVal}>₹{totals.gross.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                </View>
                {totals.taxTotal > 0 && (
                  <View style={s.runTotalRow}>
                    <Text style={s.runTotalLabel}>Tax</Text>
                    <Text style={s.runTotalVal}>₹{totals.taxTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                  </View>
                )}
                {totals.logisticsTotal > 0 && (
                  <View style={s.runTotalRow}>
                    <Text style={s.runTotalLabel}>Charges</Text>
                    <Text style={s.runTotalVal}>₹{totals.logisticsTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                  </View>
                )}
                {totals.roundOff !== 0 && (
                  <View style={s.runTotalRow}>
                    <Text style={s.runTotalLabel}>Round Off</Text>
                    <Text style={s.runTotalVal}>₹{totals.roundOff.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                  </View>
                )}
                <View style={[s.runTotalRow, s.runTotalGrandRow]}>
                  <Text style={s.runTotalGrandLabel}>Grand Total</Text>
                  <Text style={s.runTotalGrandVal}>₹{totals.grand.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                </View>
              </View>

              {/* Narration */}
              <View style={s.card} onLayout={(e) => { notesCardY.current = e.nativeEvent.layout.y; }}>
                <View style={s.cardHdr}>
                  <Ionicons name="document-outline" size={18} color={COLORS.textSecondary} />
                  <Text style={s.cardTitle}>Notes</Text>
                </View>
                <View onLayout={(e) => { narrationOffset.current = e.nativeEvent.layout.y; }}>
                  <FormField
                    label="Narration"
                    value={narration}
                    onChangeText={setNarration}
                    placeholder="Delivery instructions..."
                    multiline
                    numberOfLines={2}
                    style={{ minHeight: 60, textAlignVertical: 'top' } as any}
                    containerStyle={{ marginBottom: 0 }}
                    onFocus={() => scrollToFieldY(narrationOffset.current)}
                  />
                </View>
              </View>
            </>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {step === 3 && (
            <View style={s.grandTotalBar}>
              <View>
                <Text style={s.grandTotalMeta}>
                  {items.filter(i => i.product).length} item{items.filter(i => i.product).length !== 1 ? 's' : ''} · {party || 'No customer'}
                </Text>
                <Text style={s.grandTotalLabel}>Grand Total</Text>
              </View>
              <Text style={s.grandTotalAmt} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>₹{totals.grand.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
            </View>
          )}
          <View style={s.footerBtnRow}>
            {step === 1 && (
              <TouchableOpacity style={s.fullNextBtn} onPress={goNext} activeOpacity={0.7}>
                <Text style={s.nextBtnTxt}>Next: Order & Dispatch →</Text>
              </TouchableOpacity>
            )}
            {step === 2 && (
              <>
                <TouchableOpacity style={s.backOutlineBtn} onPress={goBack} activeOpacity={0.7}>
                  <Text style={s.backOutlineTxt}>← Details</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.fullNextBtn} onPress={goNext} activeOpacity={0.7}>
                  <Text style={s.nextBtnTxt}>Next: Items →</Text>
                </TouchableOpacity>
              </>
            )}
            {step === 3 && (
              <>
                <TouchableOpacity style={s.backOutlineBtn} onPress={goBack} activeOpacity={0.7}>
                  <Text style={s.backOutlineTxt}>← Dispatch</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.submitBtn, submitting && { opacity: 0.6 }]} onPress={handleSubmit} activeOpacity={0.7} disabled={submitting}>
                  {submitting ? <ActivityIndicator size="small" color={COLORS.white} /> : <Ionicons name="checkmark-circle" size={18} color={COLORS.white} />}
                  <Text style={s.submitTxt}>{submitting ? 'Submitting...' : '✓ Create Delivery Note'}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      <DatePickerModal
        visible={showDatePicker}
        value={date}
        minDate={fyStart}
        maxDate={fyEnd}
        onSelect={(d) => { setDate(d); setShowDatePicker(false); }}
        onClose={() => setShowDatePicker(false)}
        title="Delivery Note Date"
      />
      <DatePickerModal
        visible={showLrDatePicker}
        value={lrDate || date}
        onSelect={(d) => { setLrDate(d); setShowLrDatePicker(false); }}
        onClose={() => setShowLrDatePicker(false)}
        title="LR / Bill of Lading Date"
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  headerSub: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 1 },
  scroll: { padding: SPACING.md, paddingBottom: 120 },
  card: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  cardHdr: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.md },
  cardTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  row2: { flexDirection: 'row', gap: 12, marginBottom: SPACING.md },
  fLabel: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  fInput: { backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, minHeight: 48, justifyContent: 'center', ...Platform.select({ web: { outlineWidth: 0, outlineStyle: 'none' } as any }) },
  fInputFocused: { borderColor: COLORS.brandPrimary, borderWidth: 1.5 },
  autoBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, minHeight: 48 },
  autoTxt: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '600' },
  helperTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontStyle: 'italic', marginTop: 2 },
  gstRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5, marginBottom: 2, paddingHorizontal: 2 },
  gstTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.positive, fontWeight: '600' },
  gstSubTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  star: { color: COLORS.negative },
  sectionHdr: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.sm },
  sectionTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  sectionSummary: { flex: 1, fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontStyle: 'italic' },
  itemCount: { backgroundColor: COLORS.brandPrimary, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  itemCountTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: '#fff' },
  addItemBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.positiveBg, borderRadius: RADIUS.md, paddingVertical: 14, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.positive + '40', borderStyle: 'dashed' },
  addItemTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.positive },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  toggleIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  toggleTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  toggleSub: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 1 },
  toggleBody: { marginTop: SPACING.md },
  divider: { height: 1, backgroundColor: COLORS.borderDefault, marginBottom: SPACING.md },
  runningTotalCard: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1.5, borderColor: COLORS.brandPrimary + '30' },
  runTotalTitle: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  runTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  runTotalLabel: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  runTotalVal: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  runTotalGrandRow: { paddingTop: 8, marginTop: 4, borderTopWidth: 1, borderTopColor: COLORS.borderDefault, marginBottom: 0 },
  runTotalGrandLabel: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  runTotalGrandVal: { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.brandPrimary },
  footer: { flexDirection: 'column' as const, gap: 8, paddingHorizontal: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg },
  footerBtnRow: { flexDirection: 'row' as const, gap: 12 },
  grandTotalBar: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, paddingHorizontal: 2, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  grandTotalMeta: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontWeight: '600' as const, marginBottom: 1 },
  grandTotalLabel: { fontSize: TYPOGRAPHY.sm, fontWeight: '700' as const, color: COLORS.textSecondary },
  grandTotalAmt: { fontSize: TYPOGRAPHY.xl, fontWeight: '800' as const, color: COLORS.brandPrimary, flexShrink: 1, marginLeft: 8, textAlign: 'right' as const },
  fullNextBtn: { flex: 1, paddingVertical: 16, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  nextBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
  backOutlineBtn: { flex: 1, paddingVertical: 14, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.borderDefault, alignItems: 'center', justifyContent: 'center' },
  backOutlineTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textSecondary },
  submitBtn: { flex: 2, flexDirection: 'row', gap: 8, paddingVertical: 14, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  submitTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});

const ir = StyleSheet.create({
  card: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: SPACING.md, paddingVertical: 12 },
  rowHeaderTxt: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '600' },
  rowHeaderTxtActive: { color: COLORS.textPrimary, fontWeight: '700' },
  rowHeaderAmt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.positive, backgroundColor: COLORS.positiveBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.full },
  expandedContent: { paddingHorizontal: SPACING.sm, paddingBottom: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.borderDefault, gap: 8, paddingTop: SPACING.sm },
  fieldLabel: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 4 },
  star: { color: COLORS.negative },
  qurRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 10 },
  qtyBox: { width: 72 },
  unitBox: { width: 64 },
  rateBox: { flex: 1 },
  miniLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontWeight: '600', marginBottom: 4 },
  miniInput: { backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 8, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary },
  unitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 8, borderWidth: 1, borderColor: COLORS.borderDefault, minHeight: 36 },
  unitTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  taxableRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.pageBg, borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 7 },
  taxableLabel: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  taxableVal: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  taxSection: { borderTopWidth: 1, borderTopColor: COLORS.borderDefault, paddingTop: 8, gap: 6 },
  taxSectionHdr: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  taxSectionTitle: { flex: 1, fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textSecondary },
  taxColHint: { fontSize: 10, color: COLORS.textTertiary, fontStyle: 'italic' },
  taxEntryCard: { backgroundColor: COLORS.pageBg, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' as const, marginBottom: 4 },
  taxEntryTopRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingHorizontal: 6, paddingVertical: 2, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  taxEntryBottomRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, padding: 8, paddingTop: 6 },
  taxFieldGroup: { gap: 2 },
  taxMiniLbl: { fontSize: 10, fontWeight: '600' as const, color: COLORS.textTertiary },
  taxFieldInputRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 3 },
  taxRateInput: { width: 44, backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.sm, paddingHorizontal: 4, fontSize: TYPOGRAPHY.xs, color: COLORS.textPrimary, paddingVertical: 5, textAlign: 'right' },
  taxRateSign: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontWeight: '600' },
  taxAmtInput: { width: 60, backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.sm, paddingHorizontal: 4, fontSize: TYPOGRAPHY.xs, color: COLORS.textPrimary, paddingVertical: 5, textAlign: 'right' },
  subtotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  subtotalLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontWeight: '600' },
  subtotalVal: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  addTaxDashedBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderStyle: 'dashed' as const, borderColor: COLORS.brandPrimary + '70', borderRadius: RADIUS.sm, paddingVertical: 10, marginTop: 4, marginBottom: 4 },
  addTaxDashedTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.brandPrimary, fontWeight: '600' },
  headerTrashBtn: { marginLeft: 8, padding: 4, borderRadius: RADIUS.sm },
});

const si = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, paddingHorizontal: SPACING.lg, paddingVertical: 12 },
  stepItem: { alignItems: 'center', gap: 4 },
  circle: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center' },
  circleActive: { borderColor: '#C9A84C', backgroundColor: '#C9A84C' },
  circleDone: { borderColor: '#1C1C1C', backgroundColor: '#1C1C1C' },
  circleNum: { fontSize: TYPOGRAPHY.xs, fontWeight: '700' as const, color: COLORS.textTertiary },
  circleNumActive: { color: COLORS.white },
  label: { fontSize: 10, fontWeight: '600' as const, color: COLORS.textTertiary, maxWidth: 72, textAlign: 'center' as const },
  labelActive: { color: '#C9A84C', fontWeight: '700' as const },
  line: { flex: 1, height: 2, backgroundColor: COLORS.borderDefault, marginBottom: 18, marginHorizontal: 4 },
  lineDone: { backgroundColor: COLORS.brandPrimary },
});

const ss = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  card: { backgroundColor: COLORS.cardBg, borderRadius: 24, padding: 28, width: '88%', alignItems: 'center', gap: 10 },
  iconWrap: { marginBottom: 4 },
  title: { fontSize: TYPOGRAPHY.lg, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center' },
  sub: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  refBadge: { backgroundColor: COLORS.pageBg, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', width: '100%', borderWidth: 1, borderColor: COLORS.borderDefault },
  refLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontWeight: '600', marginBottom: 2 },
  refVal: { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.brandPrimary },
  previewBtn: { flexDirection: 'row', gap: 8, backgroundColor: COLORS.pageBg, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20, width: '100%', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.borderStrong },
  previewBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.brandPrimary },
  doneBtn: { paddingVertical: 12, width: '100%', alignItems: 'center' },
  doneTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textSecondary },
});
