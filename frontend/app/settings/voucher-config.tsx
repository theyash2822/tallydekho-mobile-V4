import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, StyleSheet,
  Modal, TextInput, Image, Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { safePush } from '../../src/utils/safeNavigation';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { getUserSettings, updateUserSettings, getBankLedgers, getCompanyLogo, getComplianceConfig, saveComplianceConfig } from '../../src/services/api';
import { generateDocumentHTML, DocumentFormat, resolveDocumentFormat } from '../../src/utils/documentHelpers';
import { clearVoucherConfigCache } from '../../src/utils/voucherPdf';
import {
  ThermalPaperWidth,
  DEFAULT_THERMAL_PAPER_WIDTH,
  isThermalTemplateId,
  thermalPageSize,
} from '../../src/utils/pdf/thermalShared';
import { sanitizeImageSrc } from '../../src/utils/sanitizeImageSrc';
import {
  normalizeThermalWidth,
  writeLocalVoucherConfig,
  readLocalVoucherConfig,
  bankInfoFromConfig,
  qrDataUrlFromConfig,
  getQrPayloadFromConfig,
  toSafePdfImageSrc,
  BankLedgerRow,
} from '../../src/utils/voucherPdfConfig';
import QRCodeSvg from 'react-native-qrcode-svg';

// Bank options are fetched from Tally (see useEffect in component)
const FALLBACK_BANK_OPTS = [
  { value: 'Cash', label: 'Cash' },
];

const VOUCHER_TYPES = [
  { id: 'sales_inv',      label: 'Sales Invoice',    icon: 'receipt-outline'          },
  { id: 'purchase_inv',   label: 'Purchase Invoice',  icon: 'cart-outline'             },
  { id: 'sales_order',    label: 'Sales Order',       icon: 'bag-outline'              },
  { id: 'purchase_order', label: 'Purchase Order',    icon: 'cube-outline'             },
  { id: 'credit_note',    label: 'Credit Note',       icon: 'arrow-undo-outline'       },
  { id: 'debit_note',     label: 'Debit Note',        icon: 'arrow-redo-outline'       },
  { id: 'delivery_note',  label: 'Delivery Note',     icon: 'bicycle-outline'          },
  { id: 'payment',        label: 'Payment Voucher',   icon: 'arrow-up-circle-outline'  },
  { id: 'receipt',        label: 'Receipt Voucher',   icon: 'arrow-down-circle-outline'},
  { id: 'expense',        label: 'Expense Voucher',   icon: 'wallet-outline'           },
  { id: 'journal',        label: 'Journal Voucher',   icon: 'book-outline'             },
  { id: 'contra',         label: 'Contra Voucher',    icon: 'swap-horizontal-outline'  },
];

const DEFAULT_TERMS: Record<string, string[]> = {
  sales_inv:      ['Payment due within 30 days of invoice date.', 'Goods once sold will not be returned without prior approval.'],
  purchase_inv:   ['All payments subject to receipt and verification of goods.', 'Disputes must be raised within 7 days of receipt.'],
  sales_order:    ['Order confirmation required within 48 hours.', 'Prices are valid for 7 days from order date.'],
  purchase_order: ['Delivery must match PO specifications exactly.', 'Advance payment required before dispatch.'],
  credit_note:    ['Credit to be adjusted against next invoice.', 'Credit is non-refundable and non-transferable.'],
  debit_note:     ['Debit note raised against purchase invoice reference.', 'Amount payable within 15 days of issue.'],
  delivery_note:  ['Goods dispatched as per order specifications.', 'Recipient must verify quantity and condition on delivery.'],
};

interface VConfig {
  format:    DocumentFormat;
  /** Only used when format is Thermal — 80 default / 58 compact. */
  thermalPaperWidth: ThermalPaperWidth;
  bank:      string;
  qrEnabled: boolean;
  /** Upload image vs generate QR from UPI ID. */
  qrMode:    'upload' | 'generate';
  qrImage:   string | null;
  terms:     string[];
  qrUpiId:   string;
}

/** Infer qrMode for configs saved before this field existed. */
function resolveQrMode(cfg: Partial<VConfig> & Record<string, any> | null | undefined): 'upload' | 'generate' {
  if (cfg?.qrMode === 'upload' || cfg?.qrMode === 'generate') return cfg.qrMode;
  if (cfg?.qrImage) return 'upload';
  return 'generate';
}

/** Drop removed Website / Bank Details QR fields from saved configs. */
function sanitizeVConfig(raw: any, fallback: VConfig): VConfig {
  const merged = { ...fallback, ...(raw && typeof raw === 'object' ? raw : {}) };
  return {
    format: resolveDocumentFormat(merged.format),
    thermalPaperWidth: normalizeThermalWidth(merged.thermalPaperWidth ?? fallback.thermalPaperWidth),
    bank: typeof merged.bank === 'string' && merged.bank ? merged.bank : 'Cash',
    qrEnabled: !!merged.qrEnabled,
    qrMode: resolveQrMode(merged),
    qrImage: merged.qrImage || null,
    terms: Array.isArray(merged.terms) ? merged.terms : fallback.terms,
    qrUpiId: typeof merged.qrUpiId === 'string' ? merged.qrUpiId : '',
  };
}

const makeDefault = (id: string): VConfig => ({
  format: 'tally_classic_v1',
  thermalPaperWidth: DEFAULT_THERMAL_PAPER_WIDTH,
  bank: 'Cash',
  qrEnabled: false,
  qrMode: 'generate',
  qrImage: null,
  terms: DEFAULT_TERMS[id] ?? [],
  qrUpiId: '',
});

const FORMAT_OPTIONS: Array<{ id: DocumentFormat; label: string }> = [
  { id: 'tally_classic_v1', label: 'Tally Classic' },
  { id: 'td_thermal_v1',    label: 'TallyDekho Thermal' },
  { id: 'td_executive_v1',  label: 'TallyDekho Executive' },
];

/** Live QR preview when Generate from UPI is selected and UPI ID is filled. */
function GeneratedQrPreview({ cfg }: { cfg: VConfig }) {
  if (!cfg.qrEnabled || resolveQrMode(cfg) !== 'generate') return null;

  const payload = getQrPayloadFromConfig({
    ...cfg,
    qrMode: 'generate',
    qrImage: null,
    qrEnabled: true,
  } as any);
  if (!payload) return null;

  return (
    <View style={s.qrPreviewCard}>
      <View style={s.qrGeneratedWrap}>
        <QRCodeSvg value={payload} size={160} backgroundColor={COLORS.cardBg} color="#111111" />
      </View>
      <View style={s.qrPreviewFooter}>
        <View style={s.qrPreviewStatus}>
          <Ionicons name="checkmark-circle" size={14} color={COLORS.brandPrimary} />
          <Text style={s.qrPreviewStatusTxt}>Generated from UPI · ready for PDF</Text>
        </View>
      </View>
    </View>
  );
}

// ── Format Thumbnail (mini PDF preview) ───────────────────────────────────────
function FormatThumb({ type }: { type: DocumentFormat }) {
  const L = StyleSheet.create({
    doc:   { width: '100%', aspectRatio: 0.75, backgroundColor: '#FAFAFA', padding: 6, borderRadius: 2 },
    ln:    { height: 2, backgroundColor: '#D4D4D4', borderRadius: 1 },
    div:   { height: 1, backgroundColor: '#E8E8E8', marginVertical: 3 },
    row:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 1.5 },
    sq:    { width: 14, height: 14, borderRadius: 2, backgroundColor: '#DADADA' },
    smSq:  { width: 10, height: 10, borderRadius: 1, backgroundColor: '#DADADA' },
    circ:  { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: '#D4D4D4' },
  });

  const resolved = resolveDocumentFormat(type);

  if (resolved === 'tally_classic_v1') return (
    <View style={L.doc}>
      {/* Tally Classic: centered letterhead + ruled grid */}
      <View style={{ alignItems: 'center', gap: 2, marginBottom: 3 }}>
        <View style={[L.ln, { width: '70%', height: 3 }]} />
        <View style={[L.ln, { width: '55%' }]} />
        <View style={[L.ln, { width: '40%' }]} />
      </View>
      <View style={L.div} />
      <View style={L.row}><View style={[L.ln, { width: '38%' }]} /><View style={[L.ln, { width: '30%' }]} /></View>
      <View style={L.div} />
      {[0,1,2].map(i => <View key={i} style={L.row}><View style={[L.ln, { width: '6%' }]} /><View style={[L.ln, { width: '48%' }]} /><View style={[L.ln, { width: '18%' }]} /></View>)}
      <View style={L.div} />
      <View style={{ alignItems: 'flex-end' }}><View style={[L.ln, { width: '28%', height: 3 }]} /></View>
    </View>
  );

  if (resolved === 'td_thermal_v1') return (
    <View style={[L.doc, { alignItems: 'center', paddingHorizontal: 14 }]}>
      {/* Thermal: narrow receipt strip */}
      <View style={{ width: '55%', gap: 2, alignItems: 'center' }}>
        <View style={[L.ln, { width: '90%', height: 3 }]} />
        <View style={[L.ln, { width: '70%' }]} />
        <View style={[L.ln, { width: '100%', height: 1, marginVertical: 3 }]} />
        <View style={[L.ln, { width: '80%' }]} />
        {[0,1,2].map(i => (
          <View key={i} style={{ width: '100%', marginVertical: 1.5 }}>
            <View style={[L.ln, { width: '100%' }]} />
            <View style={[L.ln, { width: '55%', marginTop: 2, alignSelf: 'flex-end' }]} />
          </View>
        ))}
        <View style={[L.ln, { width: '100%', height: 1, marginVertical: 3 }]} />
        <View style={[L.ln, { width: '60%', height: 3, alignSelf: 'flex-end' }]} />
      </View>
    </View>
  );

  return (
    <View style={L.doc}>
      {/* Executive: compact metadata strip */}
      <View style={{ flexDirection: 'row', marginBottom: 3 }}>
        <View style={{ flex: 1, paddingRight: 3 }}><View style={L.smSq} /><View style={[L.ln, { width: '80%', marginTop: 3 }]} /><View style={[L.ln, { width: '60%', marginTop: 2 }]} /></View>
        <View style={{ width: 1, backgroundColor: '#E8E8E8' }} />
        <View style={{ flex: 1, paddingLeft: 3, gap: 2 }}><View style={[L.ln, { width: '80%' }]} /><View style={[L.ln, { width: '60%' }]} /><View style={[L.ln, { width: '70%' }]} /></View>
      </View>
      <View style={L.div} />
      {[0,1].map(i => <View key={i} style={L.row}><View style={[L.ln, { width: '6%' }]} /><View style={[L.ln, { width: '48%' }]} /><View style={[L.ln, { width: '18%' }]} /></View>)}
      <View style={L.div} />
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 2 }}>
        <View style={{ flex: 1, gap: 2 }}><View style={[L.ln, { width: '85%' }]} /><View style={[L.ln, { width: '65%' }]} /></View>
        <View style={L.circ} />
      </View>
    </View>
  );
}

// ── Custom Themed Toggle ───────────────────────────────────────────────────────
function CustomToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: value ? 1 : 0, useNativeDriver: false, tension: 60, friction: 7 }).start();
  }, [value, anim]);
  const trackBg = anim.interpolate({ inputRange: [0,1], outputRange: [COLORS.borderStrong, COLORS.brandPrimary] });
  const thumbX  = anim.interpolate({ inputRange: [0,1], outputRange: [2, 22] });
  return (
    <TouchableOpacity onPress={() => onChange(!value)} activeOpacity={0.85}>
      <Animated.View style={[ct.track, { backgroundColor: trackBg }]}>
        <Animated.View style={[ct.thumb, { transform: [{ translateX: thumbX }] }]} />
      </Animated.View>
    </TouchableOpacity>
  );
}
const ct = StyleSheet.create({
  track: { width: 46, height: 26, borderRadius: 13, justifyContent: 'center' },
  thumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.white, elevation: 2 },
});

// ── Generic Picker Sheet ──────────────────────────────────────────────────────
type PickerItem = { value: string; label: string; sublabel?: string };
function PickerSheet({ visible, title, items, selected, onSelect, onClose }: {
  visible: boolean; title: string; items: PickerItem[];
  selected: string; onSelect: (v: string) => void; onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={pk.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={[pk.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={pk.handle} />
          <Text style={pk.title}>{title}</Text>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 2, paddingBottom: 8 }}>
            {items.map(item => {
              const active = selected === item.value;
              return (
                <TouchableOpacity key={item.value} style={[pk.row, active && pk.rowActive]}
                  onPress={() => { onSelect(item.value); onClose(); }} activeOpacity={0.7}>
                  <View style={pk.rowLeft}>
                    <Text style={[pk.rowLabel, active && pk.rowLabelActive]}>{item.label}</Text>
                    {item.sublabel ? <Text style={[pk.rowSub, active && pk.rowSubActive]}>{item.sublabel}</Text> : null}
                  </View>
                  {active ? <Ionicons name="checkmark" size={18} color={COLORS.white} /> : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
const pk = StyleSheet.create({
  overlay:       { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.48)' },
  sheet:         { backgroundColor: COLORS.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: SPACING.md, paddingTop: 12, maxHeight: '60%' },
  handle:        { width: 40, height: 4, backgroundColor: COLORS.borderStrong, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  title:         { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center', marginBottom: 12 },
  row:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 12, borderRadius: RADIUS.md },
  rowActive:     { backgroundColor: COLORS.brandPrimary },
  rowLeft:       { flex: 1, gap: 2 },
  rowLabel:      { fontSize: TYPOGRAPHY.base, fontWeight: '500', color: COLORS.textPrimary },
  rowLabelActive:{ color: COLORS.white, fontWeight: '700' },
  rowSub:        { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  rowSubActive:  { color: 'rgba(255,255,255,0.65)' },
});

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function VoucherConfigScreen() {
  const router = useRouter();
  const { company } = useAuth();
  const [expanded,      setExpanded]      = useState<string | null>('sales_inv');
  const [configs,       setConfigs]       = useState<Record<string, VConfig>>(
    Object.fromEntries(VOUCHER_TYPES.map(v => [v.id, makeDefault(v.id)]))
  );
  const [bankOpts, setBankOpts] = useState<{ value: string; label: string }[]>(FALLBACK_BANK_OPTS);
  const [bankRows, setBankRows] = useState<BankLedgerRow[]>([]);
  const [bankPickerFor, setBankPickerFor] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const markDirty = () => setIsDirty(true);
  const [saving,        setSaving]        = useState<string | null>(null);

  // ── Compliance Config State ────────────────────────────────────────────────────────
  const [numberingPolicy, setNumberingPolicy]       = useState<'tally_prime_series'|'tallydekho_series'>('tally_prime_series');
  const [eInvoiceApplicable, setEInvoiceApplicable] = useState<'not_applicable'|'applicable_not_configured'|'applicable_configured'>('not_applicable');
  const [eInvoiceMode, setEInvoiceMode]             = useState<'manual'|'auto'>('manual');
  const [eWayBillApplicable, setEWayBillApplicable] = useState<'not_applicable'|'applicable_not_configured'|'applicable_configured'>('not_applicable');
  const [eWayBillMode, setEWayBillMode]             = useState<'manual'|'auto'|'ask_after_irn'>('manual');
  const [complianceDirty, setComplianceDirty]       = useState(false);
  const [complianceOpen, setComplianceOpen]         = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const companyLogoRef = useRef<string | null>(null);

  // Load bank ledgers from Tally on mount
  useEffect(() => {
    if (!company?.guid) return;
    getBankLedgers(company.guid, 'bank').then((res: any) => {
      if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
        setBankRows(res.data);
        const opts = [
          ...FALLBACK_BANK_OPTS,
          ...res.data.map((b: any) => ({ value: b.name, label: b.name })),
        ];
        setBankOpts(opts);
      }
    }).catch(() => {});
  }, [company?.guid]);

  // Load company logo for PDF preview
  useEffect(() => {
    if (!company?.guid) return;
    const key = `company_logo_${company.guid}`;
    getCompanyLogo(company.guid).then(async (res: any) => {
      const url = res?.data?.logo_url;
      if (url) {
        companyLogoRef.current = await toSafePdfImageSrc(url);
      } else {
        const uri = await AsyncStorage.getItem(key);
        companyLogoRef.current = await toSafePdfImageSrc(uri);
      }
    }).catch(async () => {
      const uri = await AsyncStorage.getItem(key);
      companyLogoRef.current = await toSafePdfImageSrc(uri);
    });
  }, [company?.guid]);

  // Load persisted config: backend first (full), local = format + thermal only
  useEffect(() => {
    const applyParsed = (parsed: any) => {
      setConfigs(prev => {
        const merged: Record<string, VConfig> = { ...prev };
        Object.keys(parsed).forEach(k => {
          if (!merged[k]) return;
          // Strips legacy qrType / qrUrl / qrIfsc / qrAccount
          merged[k] = sanitizeVConfig(parsed[k], merged[k]);
        });
        return merged;
      });
    };

    getUserSettings().then(async (res: any) => {
      const serverConfig = res?.data?.voucher_config;
      if (serverConfig) {
        try {
          const parsed = typeof serverConfig === 'string' ? JSON.parse(serverConfig) : serverConfig;
          applyParsed(parsed);
          writeLocalVoucherConfig(parsed).catch(() => {});
        } catch {}
      } else {
        const local = await readLocalVoucherConfig();
        if (local) applyParsed(local);
      }
    }).catch(async () => {
      const local = await readLocalVoucherConfig();
      if (local) applyParsed(local);
    });
  }, []);

  // Load compliance config on mount
  useEffect(() => {
    if (!company?.guid) return;
    getComplianceConfig(company.guid).then((res: any) => {
      const d = res?.data;
      if (d) {
        setNumberingPolicy(d.numbering_policy || 'tally_prime_series');
        setEInvoiceApplicable(d.e_invoice_applicable || 'not_applicable');
        setEInvoiceMode(d.e_invoice_mode || 'manual');
        setEWayBillApplicable(d.e_way_bill_applicable || 'not_applicable');
        setEWayBillMode(d.e_way_bill_mode || 'manual');
      }
    }).catch(() => {});
  }, [company?.guid]);

  const saveComplianceSettings = async () => {
    if (!company?.guid) return;
    try {
      await saveComplianceConfig(company.guid, {
        numbering_policy: numberingPolicy,
        e_invoice_applicable: eInvoiceApplicable,
        e_invoice_mode: eInvoiceMode,
        e_way_bill_applicable: eWayBillApplicable,
        e_way_bill_mode: eWayBillMode,
      });
      setComplianceDirty(false);
      Toast.show({ type: 'success', text1: 'Settings Saved' });
    } catch {
      Toast.show({ type: 'error', text1: 'Save Failed' });
    }
  };

  const update = (id: string, key: keyof VConfig, val: any) => {
    setConfigs(prev => ({ ...prev, [id]: { ...prev[id], [key]: val } }));
    setIsDirty(true);
  };

  const updateTerm = (id: string, idx: number, text: string) =>
    setConfigs(prev => ({ ...prev, [id]: { ...prev[id], terms: prev[id].terms.map((t, i) => i === idx ? text : t) } }));

  const removeTerm = (id: string, idx: number) =>
    setConfigs(prev => ({ ...prev, [id]: { ...prev[id], terms: prev[id].terms.filter((_, i) => i !== idx) } }));

  const addTerm = (id: string) =>
    setConfigs(prev => ({ ...prev, [id]: { ...prev[id], terms: [...prev[id].terms, ''] } }));

  const pickQrBusyRef = useRef(false);

  const handlePickQR = async (id: string) => {
    if (pickQrBusyRef.current) return;
    pickQrBusyRef.current = true;
    try {
      // Prefer existing grant; requesting again can swallow the next launch on iOS.
      let perm = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        if (!perm.canAskAgain) {
          Toast.show({
            type: 'error',
            text1: 'Permission Required',
            text2: 'Allow photo library access in Settings to upload a QR.',
          });
          return;
        }
        perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Toast.show({
            type: 'error',
            text1: 'Permission Required',
            text2: 'Please allow photo library access.',
          });
          return;
        }
        // Let the system permission sheet dismiss before opening the gallery
        // (otherwise the first tap appears to do nothing).
        await new Promise<void>((r) => setTimeout(r, 350));
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setConfigs((prev) => ({
          ...prev,
          [id]: { ...prev[id], qrImage: uri, qrMode: 'upload' },
        }));
        setIsDirty(true);
      }
    } finally {
      pickQrBusyRef.current = false;
    }
  };

  const handleUseFormat = async (id: string, label: string, format: DocumentFormat) => {
    setSaving(id);
    try {
      const stamped = {
        ...sanitizeVConfig({ ...configs[id], format }, makeDefault(id)),
        _updatedAt: Date.now(),
      };
      const updated = { ...configs, [id]: stamped };
      setConfigs(updated);
      await writeLocalVoucherConfig(updated);
      await updateUserSettings({ voucher_config: updated }).catch(() => {});
      clearVoucherConfigCache();
      const formatLabel = FORMAT_OPTIONS.find(f => f.id === format)?.label || format;
      Toast.show({ type: 'success', text1: `${label} Updated`, text2: `${formatLabel} format applied and saved.` });
    } catch {
      Toast.show({ type: 'error', text1: 'Save Failed', text2: 'Could not save format selection.' });
    } finally {
      setSaving(null);
    }
  };

  const handleSaveAll = async () => {
    const stamped = Object.fromEntries(
      Object.entries(configs).map(([k, v]) => [
        k,
        { ...sanitizeVConfig(v, makeDefault(k)), _updatedAt: Date.now() },
      ])
    );
    setConfigs(stamped as Record<string, VConfig>);
    await writeLocalVoucherConfig(stamped);
    await updateUserSettings({ voucher_config: stamped }).catch(() => {});
    clearVoucherConfigCache();
    setIsDirty(false);
    Toast.show({ type: 'success', text1: 'All Configurations Saved', text2: 'Voucher settings updated for all types.' });
  };

  const handlePDFPreview = async (id: string, label: string) => {
    setPreviewLoading(id);
    try {
      const cfg = configs[id];
      const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      const documentType =
        id === 'purchase_inv' ? 'purchase_invoice'
        : id === 'sales_order' ? 'sales_order'
        : id === 'purchase_order' ? 'purchase_order'
        : id === 'credit_note' ? 'credit_note'
        : id === 'debit_note' ? 'debit_note'
        : id === 'delivery_note' ? 'delivery_note'
        : id === 'payment' ? 'payment_voucher'
        : id === 'receipt' ? 'receipt_voucher'
        : id === 'expense' ? 'expense_voucher'
        : id === 'journal' ? 'journal_voucher'
        : id === 'contra' ? 'contra_voucher'
        : 'sales_invoice';
      const isMoney = ['payment_voucher', 'receipt_voucher', 'expense_voucher', 'contra_voucher', 'journal_voucher'].includes(documentType);
      const sampleDoc: any = {
        documentType,
        documentNumber: 'SMPL/2425/001',
        date: today,
        reference: '',
        company: {
          name: company?.name || 'Your Company',
          address: 'Mumbai, Maharashtra',
          gstin: company?.gstin || '27AAJCR0000E1Z2',
          pan: 'AAJCR0000E',
          state: 'Maharashtra',
          stateCode: '27',
          email: 'accounts@example.com',
          jurisdiction: 'Mumbai',
        },
        party: {
          name: 'Sample Customer', address: 'Delhi, India',
          gstin: '07AABCD1234E1ZP', state: 'Delhi', stateCode: '07',
        },
        items: isMoney ? [] : [
          { name: 'Sample Product A', hsn: '8471', qty: 10, unit: 'PCS', rate: 500, discount: 0, amount: 5000, taxableAmount: 5000 },
          { name: 'Sample Product B', hsn: '8517', qty: 5,  unit: 'PCS', rate: 1200, discount: 0, amount: 6000, taxableAmount: 6000 },
        ],
        ledgerEntries: isMoney ? [
          { id: '1', particulars: 'Sample Customer', debit: 12980, reference: 'Account' },
          { id: '2', particulars: cfg.bank || 'Cash', credit: 12980, reference: 'Through' },
        ] : [],
        totals: {
          subtotal: 11000, discount: 0, taxableAmount: 11000,
          cgstTotal: isMoney ? 0 : 990, sgstTotal: isMoney ? 0 : 990, igstTotal: 0,
          taxTotal: isMoney ? 0 : 1980, roundOff: 0, total: 12980, balanceDue: 12980,
          drTotal: 12980, crTotal: 12980,
        },
        taxes: isMoney ? [] : [
          { label: 'CGST', name: 'CGST', kind: 'cgst', rate: 9, amount: 990 },
          { label: 'SGST', name: 'SGST', kind: 'sgst', rate: 9, amount: 990 },
        ],
        hsnSummary: isMoney ? [] : [
          { hsn: '8471', taxableValue: 5000, cgstRate: 9, cgstAmount: 450, sgstRate: 9, sgstAmount: 450, totalTax: 900 },
          { hsn: '8517', taxableValue: 6000, cgstRate: 9, cgstAmount: 540, sgstRate: 9, sgstAmount: 540, totalTax: 1080 },
        ],
        tallyMeta: { paymentTerms: '30 Days', destination: 'Delhi', dispatchedThrough: 'Road' },
        narration: 'Sample preview document',
        terms: cfg.terms.join('\n'),
        bankDetails: null,
      };
      const bankInfo = bankInfoFromConfig(cfg as any, bankRows);
      const mode = resolveQrMode(cfg);
      const qrCfg = {
        ...cfg,
        qrMode: mode,
        qrImage: mode === 'generate' ? null : cfg.qrImage,
      };
      let qrImage: string | null = null;
      if (cfg.qrEnabled) {
        qrImage = await qrDataUrlFromConfig(qrCfg as any);
        qrImage = sanitizeImageSrc(qrImage) || qrImage;
        if (!qrImage) {
          if (mode === 'generate' && String(cfg.qrUpiId || '').trim()) {
            Toast.show({
              type: 'error',
              text1: 'QR generate failed',
              text2: 'Could not build QR for PDF. Check UPI ID and try again.',
            });
          } else if (mode === 'upload') {
            Toast.show({
              type: 'info',
              text1: 'No QR image',
              text2: 'Upload a QR image, or switch to Generate from UPI.',
            });
          }
        }
      }
      const html = generateDocumentHTML(
        sampleDoc,
        companyLogoRef.current,
        cfg.format,
        cfg.terms,
        qrImage,
        bankInfo,
        { thermalPaperWidth: normalizeThermalWidth(cfg.thermalPaperWidth) },
      );
      const format = resolveDocumentFormat(cfg.format);
      const page = isThermalTemplateId(format)
        ? thermalPageSize(normalizeThermalWidth(cfg.thermalPaperWidth))
        : { width: 595, height: 842 };
      const { uri } = await Print.printToFileAsync({ html, base64: false, ...page });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `${label} Preview` });
      } else {
        Toast.show({ type: 'info', text1: 'PDF Generated', text2: 'Sharing not available on this device.' });
      }
    } catch (err) {
      Toast.show({ type: 'error', text1: 'PDF Error', text2: 'Could not generate preview.' });
    } finally {
      setPreviewLoading(null);
    }
  };

  const bankLabel = (id: string) => bankOpts.find(b => b.value === configs[id].bank)?.label || configs[id].bank || 'Select Bank';

  const applicabilityStatus = (v: 'not_applicable' | 'applicable_not_configured' | 'applicable_configured') => {
    if (v === 'not_applicable') return { label: 'Not Applicable', bg: COLORS.activeBg, fg: COLORS.textSecondary };
    if (v === 'applicable_configured') return { label: 'Configured', bg: COLORS.positiveBg, fg: COLORS.positive };
    return { label: 'Not Configured', bg: COLORS.warningBg, fg: COLORS.warning };
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.hdr}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.hdrTitle}>Voucher Configuration</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <Text style={s.subtitle}>Configure PDF format and settings for each voucher type</Text>

        {/* ── Section 1: Voucher Numbering Policy ── */}
        <View style={s.section}>
          <TouchableOpacity
            style={s.sectionHdr}
            onPress={() => setComplianceOpen(complianceOpen === 'numbering' ? null : 'numbering')}
            activeOpacity={0.7}
          >
            <View style={s.typeIcon}>
              <Ionicons name="pricetags-outline" size={18} color={COLORS.textSecondary} />
            </View>
            <Text style={s.sectionTitle} numberOfLines={1} ellipsizeMode="tail">Voucher Numbering Policy</Text>
            <View style={[cs.statusPill, { backgroundColor: COLORS.activeBg }]}>
              <Text style={[cs.statusPillTxt, { color: COLORS.textPrimary }]}>
                {numberingPolicy === 'tally_prime_series' ? 'TallyPrime Series' : 'TallyDekho Series'}
              </Text>
            </View>
            <Ionicons name={complianceOpen === 'numbering' ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textTertiary} />
          </TouchableOpacity>

          {complianceOpen === 'numbering' && (
            <View style={s.sectionBody}>
              <Text style={cs.sectionSub}>Controls how invoice/voucher numbers are assigned</Text>

              {[
                { value: 'tally_prime_series', label: 'Follow TallyPrime Series', sub: 'TallyPrime assigns the final number (recommended)' },
                { value: 'tallydekho_series',  label: 'TallyDekho Series',        sub: 'TallyDekho generates number, pushes to Tally' },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[cs.optRow, numberingPolicy === opt.value && cs.optRowActive]}
                  onPress={() => { setNumberingPolicy(opt.value as any); setComplianceDirty(true); }}
                  activeOpacity={0.7}
                >
                  <View style={cs.optRadio}>
                    {numberingPolicy === opt.value && <View style={cs.optRadioDot} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={cs.optLabel}>{opt.label}</Text>
                    <Text style={cs.optSub}>{opt.sub}</Text>
                  </View>
                </TouchableOpacity>
              ))}

              {numberingPolicy === 'tallydekho_series' && (
                <View style={cs.warningBox}>
                  <Ionicons name="warning-outline" size={14} color="#D97706" />
                  <Text style={cs.warningTxt}>Only use if TallyDekho series is reserved exclusively for this app. E-Invoice & E-Way Bill always use TallyPrime series.</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* ── Section 2: E-Invoice Configuration ── */}
        <View style={s.section}>
          <TouchableOpacity
            style={s.sectionHdr}
            onPress={() => setComplianceOpen(complianceOpen === 'einvoice' ? null : 'einvoice')}
            activeOpacity={0.7}
          >
            <View style={s.typeIcon}>
              <Ionicons name="document-attach-outline" size={18} color={COLORS.textSecondary} />
            </View>
            <Text style={s.sectionTitle} numberOfLines={1} ellipsizeMode="tail">E-Invoice (IRN)</Text>
            {(() => { const st = applicabilityStatus(eInvoiceApplicable); return (
              <View style={[cs.statusPill, { backgroundColor: st.bg }]}>
                <Text style={[cs.statusPillTxt, { color: st.fg }]}>{st.label}</Text>
              </View>
            ); })()}
            <Ionicons name={complianceOpen === 'einvoice' ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textTertiary} />
          </TouchableOpacity>

          {complianceOpen === 'einvoice' && (
            <View style={s.sectionBody}>
              <Text style={cs.sectionSub}>For businesses with annual turnover ≥ ₹5 Cr</Text>

              {[
                { value: 'not_applicable',            label: 'Not Applicable',            sub: 'E-Invoice not required for this business' },
                { value: 'applicable_not_configured', label: 'Applicable — Not Configured', sub: 'Required but IRP credentials not set up yet' },
                { value: 'applicable_configured',     label: 'Applicable — Configured',    sub: 'IRP integrated, IRN generation enabled' },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[cs.optRow, eInvoiceApplicable === opt.value && cs.optRowActive]}
                  onPress={() => { setEInvoiceApplicable(opt.value as any); setComplianceDirty(true); }}
                  activeOpacity={0.7}
                >
                  <View style={cs.optRadio}>
                    {eInvoiceApplicable === opt.value && <View style={cs.optRadioDot} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={cs.optLabel}>{opt.label}</Text>
                    <Text style={cs.optSub}>{opt.sub}</Text>
                  </View>
                </TouchableOpacity>
              ))}

              {eInvoiceApplicable === 'applicable_configured' && (
                <View style={cs.modeRow}>
                  <Text style={cs.modeLabel}>IRN Generation Mode</Text>
                  <View style={cs.modeChips}>
                    {[{v:'manual',l:'Manual'},{v:'auto',l:'Auto after Tally sync'}].map(m => (
                      <TouchableOpacity key={m.v}
                        style={[cs.modeChip, eInvoiceMode === m.v && cs.modeChipActive]}
                        onPress={() => { setEInvoiceMode(m.v as any); setComplianceDirty(true); }}
                        activeOpacity={0.7}>
                        <Text style={[cs.modeChipTxt, eInvoiceMode === m.v && cs.modeChipTxtActive]}>{m.l}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity
                    style={cs.configLink}
                    onPress={() => safePush(router, '/settings/einvoice' as any)}
                    activeOpacity={0.7}>
                    <Ionicons name="settings-outline" size={14} color={COLORS.brandPrimary} />
                    <Text style={cs.configLinkTxt}>Configure IRP Credentials →</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>

        {/* ── Section 3: E-Way Bill Configuration ── */}
        <View style={s.section}>
          <TouchableOpacity
            style={s.sectionHdr}
            onPress={() => setComplianceOpen(complianceOpen === 'ewaybill' ? null : 'ewaybill')}
            activeOpacity={0.7}
          >
            <View style={s.typeIcon}>
              <Ionicons name="car-outline" size={18} color={COLORS.textSecondary} />
            </View>
            <Text style={s.sectionTitle} numberOfLines={1} ellipsizeMode="tail">E-Way Bill</Text>
            {(() => { const st = applicabilityStatus(eWayBillApplicable); return (
              <View style={[cs.statusPill, { backgroundColor: st.bg }]}>
                <Text style={[cs.statusPillTxt, { color: st.fg }]}>{st.label}</Text>
              </View>
            ); })()}
            <Ionicons name={complianceOpen === 'ewaybill' ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textTertiary} />
          </TouchableOpacity>

          {complianceOpen === 'ewaybill' && (
            <View style={s.sectionBody}>
              <Text style={cs.sectionSub}>For goods movement where consignment value exceeds ₹50,000</Text>

              {[
                { value: 'not_applicable',            label: 'Not Applicable',            sub: 'No goods movement or below threshold' },
                { value: 'applicable_not_configured', label: 'Applicable — Not Configured', sub: 'Required but NIC EWB credentials not set up yet' },
                { value: 'applicable_configured',     label: 'Applicable — Configured',    sub: 'EWB portal integrated, generation enabled' },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[cs.optRow, eWayBillApplicable === opt.value && cs.optRowActive]}
                  onPress={() => { setEWayBillApplicable(opt.value as any); setComplianceDirty(true); }}
                  activeOpacity={0.7}
                >
                  <View style={cs.optRadio}>
                    {eWayBillApplicable === opt.value && <View style={cs.optRadioDot} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={cs.optLabel}>{opt.label}</Text>
                    <Text style={cs.optSub}>{opt.sub}</Text>
                  </View>
                </TouchableOpacity>
              ))}

              {eWayBillApplicable === 'applicable_configured' && (
                <View style={cs.modeRow}>
                  <Text style={cs.modeLabel}>E-Way Bill Mode</Text>
                  <View style={cs.modeChips}>
                    {[
                      {v:'manual',l:'Manual'},
                      {v:'auto',l:'Auto when details ready'},
                      {v:'ask_after_irn',l:'Ask after IRN'},
                    ].map(m => (
                      <TouchableOpacity key={m.v}
                        style={[cs.modeChip, eWayBillMode === m.v && cs.modeChipActive]}
                        onPress={() => { setEWayBillMode(m.v as any); setComplianceDirty(true); }}
                        activeOpacity={0.7}>
                        <Text style={[cs.modeChipTxt, eWayBillMode === m.v && cs.modeChipTxtActive]}>{m.l}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Save compliance config button — show only if dirty */}
        {complianceDirty && (
          <TouchableOpacity style={cs.saveBtn} onPress={saveComplianceSettings} activeOpacity={0.85}>
            <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.white} />
            <Text style={cs.saveBtnTxt}>Save Compliance Settings</Text>
          </TouchableOpacity>
        )}

        {VOUCHER_TYPES.map(vt => {
          const cfg    = configs[vt.id];
          const isOpen = expanded === vt.id;
          const isSaving = saving === vt.id;

          return (
            <View key={vt.id} style={s.section}>
              {/* Accordion Header */}
              <TouchableOpacity style={s.sectionHdr} onPress={() => setExpanded(isOpen ? null : vt.id)} activeOpacity={0.7}>
                <View style={s.typeIcon}>
                  <Ionicons name={vt.icon as any} size={18} color={COLORS.textSecondary} />
                </View>
                <Text style={s.sectionTitle}>{vt.label}</Text>
                <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textTertiary} />
              </TouchableOpacity>

              {isOpen && (
                <View style={s.sectionBody}>

                  {/* ① PDF Format Selector */}
                  <View style={s.block}>
                    <Text style={s.blockLabel}>PDF FORMAT</Text>
                    <View style={s.formatRow}>
                      {FORMAT_OPTIONS.map(opt => {
                        const active = resolveDocumentFormat(cfg.format) === opt.id;
                        return (
                        <TouchableOpacity
                          key={opt.id}
                          style={[s.formatCard, active && s.formatCardActive]}
                          onPress={() => { update(vt.id, 'format', opt.id); markDirty(); }}
                          activeOpacity={0.8}
                        >
                          {active && (
                            <View style={s.formatBadge}>
                              <Ionicons name="checkmark" size={10} color={COLORS.white} />
                            </View>
                          )}
                          <FormatThumb type={opt.id} />
                          <Text style={[s.formatLbl, active && s.formatLblActive]}>
                            {opt.label}{opt.id === 'tally_classic_v1' ? ' (Default)' : ''}
                          </Text>
                        </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Thermal paper width — only when Thermal selected */}
                  {isThermalTemplateId(resolveDocumentFormat(cfg.format)) && (
                    <View style={s.block}>
                      <Text style={s.blockLabel}>THERMAL PAPER</Text>
                      <View style={s.qrTypeRow}>
                        {([
                          { v: 80 as ThermalPaperWidth, l: '80mm — Recommended' },
                          { v: 58 as ThermalPaperWidth, l: '58mm — Compact' },
                        ]).map(opt => {
                          const active = normalizeThermalWidth(cfg.thermalPaperWidth) === opt.v;
                          return (
                            <TouchableOpacity
                              key={opt.v}
                              style={[s.qrTypeChip, active && s.qrTypeChipActive]}
                              onPress={() => { update(vt.id, 'thermalPaperWidth', opt.v); markDirty(); }}
                              activeOpacity={0.7}
                            >
                              <Text style={[s.qrTypeChipTxt, active && s.qrTypeChipTxtActive]}>{opt.l}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      <Text style={s.qrSub}>
                        PDF Preview uses this roll width. On-screen cream sheets stay unchanged.
                      </Text>
                    </View>
                  )}

                  {/* ② Default Bank Account */}
                  <View style={s.block}>
                    <Text style={s.blockLabel}>DEFAULT BANK ACCOUNT</Text>
                    <TouchableOpacity style={s.dropdownTrigger} onPress={() => setBankPickerFor(vt.id)} activeOpacity={0.75}>
                      <Text style={s.dropdownValue} numberOfLines={1}>{bankLabel(vt.id)}</Text>
                      <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  {/* ③ QR Code */}
                  <View style={s.block}>
                    <View style={s.qrToggleRow}>
                      <View style={s.qrToggleLeft}>
                        <Ionicons name="qr-code-outline" size={18} color={COLORS.textSecondary} />
                        <View style={{ gap: 2 }}>
                          <Text style={s.qrTitle}>QR Code</Text>
                          <Text style={s.qrSub}>Include payment QR in PDF</Text>
                        </View>
                      </View>
                      <CustomToggle value={cfg.qrEnabled} onChange={v => update(vt.id, 'qrEnabled', v)} />
                    </View>

                    {cfg.qrEnabled && (
                      <>
                        <Text style={s.fieldHint}>Choose how the QR is added to the PDF</Text>
                        <View style={s.qrTypeRow}>
                          {([
                            { v: 'upload' as const, l: 'Upload QR', icon: 'cloud-upload-outline' as const },
                            { v: 'generate' as const, l: 'Generate from UPI', icon: 'qr-code-outline' as const },
                          ]).map(opt => {
                            const active = resolveQrMode(cfg) === opt.v;
                            return (
                              <TouchableOpacity
                                key={opt.v}
                                style={[s.qrModeChip, active && s.qrModeChipActive]}
                                onPress={() => {
                                  if (opt.v === 'generate') {
                                    setConfigs(prev => ({
                                      ...prev,
                                      [vt.id]: {
                                        ...prev[vt.id],
                                        qrMode: 'generate',
                                        qrImage: null,
                                      },
                                    }));
                                    setIsDirty(true);
                                    return;
                                  }
                                  // Upload: switch mode and open gallery on the same tap
                                  // (avoid "first tap selects mode, second tap uploads").
                                  setConfigs(prev => ({
                                    ...prev,
                                    [vt.id]: { ...prev[vt.id], qrMode: 'upload' },
                                  }));
                                  setIsDirty(true);
                                  if (!cfg.qrImage) {
                                    setTimeout(() => { void handlePickQR(vt.id); }, 0);
                                  }
                                }}
                                activeOpacity={0.7}
                              >
                                <Ionicons
                                  name={opt.icon}
                                  size={16}
                                  color={active ? COLORS.white : COLORS.textSecondary}
                                />
                                <Text style={[s.qrModeChipTxt, active && s.qrModeChipTxtActive]}>{opt.l}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>

                        {resolveQrMode(cfg) === 'generate' ? (
                          <>
                            <Text style={s.fieldHint}>
                              Enter UPI ID — QR is generated on this device (not sent to any third party).
                            </Text>
                            <TextInput
                              style={s.termInput}
                              value={cfg.qrUpiId}
                              onChangeText={t => {
                                setConfigs(prev => ({
                                  ...prev,
                                  [vt.id]: {
                                    ...prev[vt.id],
                                    qrUpiId: t,
                                    qrMode: 'generate',
                                    qrImage: null,
                                  },
                                }));
                                setIsDirty(true);
                              }}
                              placeholder="e.g. business@upi / shop@oksbi"
                              placeholderTextColor={COLORS.textTertiary}
                              autoCapitalize="none"
                              keyboardType="email-address"
                              autoCorrect={false}
                            />
                            <GeneratedQrPreview cfg={{ ...cfg, qrMode: 'generate', qrImage: null }} />
                            {!String(cfg.qrUpiId || '').trim() && (
                              <View style={s.qrEmptyHint}>
                                <Ionicons name="qr-code-outline" size={22} color={COLORS.textTertiary} />
                                <Text style={s.qrEmptyHintTxt}>QR preview appears here after you enter a UPI ID</Text>
                              </View>
                            )}
                          </>
                        ) : (
                          <>
                            <Text style={s.fieldHint}>Upload a QR image from your gallery to print on the PDF.</Text>
                            {cfg.qrImage ? (
                              <View style={s.qrPreviewCard}>
                                <Image source={{ uri: cfg.qrImage }} style={s.qrPreviewImg} resizeMode="contain" />
                                <View style={s.qrPreviewFooter}>
                                  <View style={s.qrPreviewStatus}>
                                    <Ionicons name="checkmark-circle" size={14} color={COLORS.brandPrimary} />
                                    <Text style={s.qrPreviewStatusTxt}>Uploaded QR · ready for PDF</Text>
                                  </View>
                                  <TouchableOpacity
                                    onPress={() => update(vt.id, 'qrImage', null)}
                                    activeOpacity={0.7}
                                    style={s.qrRemoveBtn}
                                  >
                                    <Ionicons name="trash-outline" size={13} color={COLORS.negative} />
                                    <Text style={s.qrRemoveTxt}>Remove</Text>
                                  </TouchableOpacity>
                                </View>
                                <TouchableOpacity style={s.qrReuploadBtn} onPress={() => handlePickQR(vt.id)} activeOpacity={0.7}>
                                  <Ionicons name="refresh-outline" size={14} color={COLORS.textSecondary} />
                                  <Text style={s.qrReuploadTxt}>Replace QR</Text>
                                </TouchableOpacity>
                              </View>
                            ) : (
                              <TouchableOpacity
                                style={s.uploadZone}
                                onPress={() => { void handlePickQR(vt.id); }}
                                activeOpacity={0.7}
                                delayPressIn={0}
                              >
                                <Ionicons name="cloud-upload-outline" size={28} color={COLORS.textTertiary} />
                                <Text style={s.uploadMainTxt}>Upload QR Code Image</Text>
                                <Text style={s.uploadSubTxt}>Tap to select from gallery · PNG or JPG</Text>
                              </TouchableOpacity>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </View>

                  {/* ④ Terms & Conditions */}
                  <View style={s.block}>
                    <Text style={s.blockLabel}>TERMS & CONDITIONS</Text>
                    {cfg.terms.map((term, idx) => (
                      <View key={idx} style={s.termRow}>
                        <View style={s.termBullet} />
                        <TextInput
                          style={s.termInput}
                          value={term}
                          onChangeText={text => updateTerm(vt.id, idx, text)}
                          multiline
                          selectionColor={COLORS.brandPrimary}
                          placeholder="Enter term..."
                          placeholderTextColor={COLORS.textTertiary}
                        />
                        <TouchableOpacity onPress={() => removeTerm(vt.id, idx)} style={s.termDeleteBtn} activeOpacity={0.7}>
                          <Ionicons name="close-circle-outline" size={17} color={COLORS.textTertiary} />
                        </TouchableOpacity>
                      </View>
                    ))}
                    <TouchableOpacity style={s.addTermBtn} onPress={() => addTerm(vt.id)} activeOpacity={0.7}>
                      <Ionicons name="add-circle-outline" size={16} color={COLORS.brandPrimary} />
                      <Text style={s.addTermTxt}>Add New</Text>
                    </TouchableOpacity>
                  </View>

                  {/* ⑤ PDF Preview + Use this format */}
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      style={s.previewBtn}
                      onPress={() => handlePDFPreview(vt.id, vt.label)}
                      disabled={previewLoading === vt.id}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="document-outline" size={15} color={COLORS.brandPrimary} />
                      <Text style={s.previewBtnTxt} numberOfLines={1}>
                        {previewLoading === vt.id ? 'Generating…' : 'PDF Preview'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.useBtn, { flex: 1 }, isSaving && s.useBtnSaving]}
                      onPress={() => { handleUseFormat(vt.id, vt.label, cfg.format); markDirty(); }}
                      disabled={isSaving}
                      activeOpacity={0.85}
                    >
                      <Text style={s.useBtnTxt}>{isSaving ? 'Saving...' : 'Use this format'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          );
        })}

        {/* Global Save */}
        {isDirty && (
        <TouchableOpacity style={s.saveAllBtn} onPress={handleSaveAll} activeOpacity={0.85}>
          <Text style={s.saveAllTxt}>Save All Configurations</Text>
        </TouchableOpacity>
        )}
        <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>


      {/* Bank Picker — single instance at root level */}
      <PickerSheet
        visible={bankPickerFor !== null}
        title="Select Bank Account"
        items={bankOpts}
        selected={bankPickerFor ? configs[bankPickerFor].bank : ''}
        onSelect={v => { if (bankPickerFor) update(bankPickerFor, 'bank', v); }}
        onClose={() => setBankPickerFor(null)}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: COLORS.pageBg },
  hdr:        { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  backBtn:    { width: 40, alignItems: 'flex-start' },
  hdrTitle:   { flex: 1, fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  scroll:     { padding: SPACING.md, gap: SPACING.sm },
  subtitle:   { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, lineHeight: 20, marginBottom: 4 },

  // Accordion
  section:     { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  sectionHdr:  { flexDirection: 'row', alignItems: 'center', gap: 12, padding: SPACING.md },
  typeIcon:    { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center' },
  sectionTitle:{ flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textPrimary },
  sectionBody: { borderTopWidth: 1, borderTopColor: COLORS.borderDefault, padding: SPACING.md, gap: SPACING.md },

  // Block (each sub-section)
  block:      { gap: 10 },
  blockLabel: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textTertiary, letterSpacing: 0.8 },

  // Format selector
  formatRow:       { flexDirection: 'row', gap: 10 },
  formatCard:      { flex: 1, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, padding: 6, backgroundColor: COLORS.pageBg, overflow: 'hidden' },
  formatCardActive:{ borderWidth: 2, borderColor: COLORS.brandPrimary, backgroundColor: COLORS.cardBg },
  formatBadge:     { position: 'absolute', top: 5, right: 5, width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  formatLbl:       { fontSize: 10, fontWeight: '500', color: COLORS.textTertiary, textAlign: 'center', marginTop: 5 },
  formatLblActive: { color: COLORS.brandPrimary, fontWeight: '700' },

  // Bank dropdown trigger
  dropdownTrigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, paddingHorizontal: 14, paddingVertical: 13 },
  dropdownValue:   { flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '500', color: COLORS.textPrimary, marginRight: 8 },

  // QR Code section
  qrToggleRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qrToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qrTitle:      { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  qrSub:        { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },

  // QR Preview Card
  qrPreviewCard:   { backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  qrGeneratedWrap: { alignItems: 'center', justifyContent: 'center', marginVertical: 16 },
  qrPreviewImg:    { width: 160, height: 160, alignSelf: 'center', marginVertical: 16 },
  qrPreviewFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 12 },
  qrPreviewStatus: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  qrPreviewStatusTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '500' },
  qrRemoveBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  qrRemoveTxt:     { fontSize: TYPOGRAPHY.xs, color: COLORS.negative, fontWeight: '600' },
  qrReuploadBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderTopWidth: 1, borderTopColor: COLORS.borderDefault, paddingVertical: 10 },
  qrReuploadTxt:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '500' },

  // Upload Zone
  uploadZone:    { borderWidth: 1.5, borderColor: COLORS.borderDefault, borderStyle: 'dashed', borderRadius: RADIUS.md, paddingVertical: 24, alignItems: 'center', gap: 6, backgroundColor: COLORS.pageBg },
  uploadMainTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  uploadSubTxt:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },

  // Terms & Conditions
  termRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 4 },
  termBullet:    { width: 5, height: 5, borderRadius: 2.5, backgroundColor: COLORS.textTertiary, marginTop: 9 },
  termInput:     { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.borderDefault, paddingHorizontal: 10, paddingVertical: 8, lineHeight: 18 },
  termDeleteBtn: { padding: 4, marginTop: 4 },
  addTermBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 2 },
  addTermTxt:    { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.brandPrimary },

  // QR type / mode chips
  qrTypeRow:        { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  qrTypeChip:       { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full, borderWidth: 1.5, borderColor: COLORS.borderDefault, backgroundColor: COLORS.pageBg },
  qrTypeChipActive: { borderColor: COLORS.brandPrimary, backgroundColor: COLORS.brandPrimary },
  qrTypeChipTxt:    { fontSize: TYPOGRAPHY.sm, fontWeight: '500', color: COLORS.textSecondary },
  qrTypeChipTxtActive: { color: COLORS.white, fontWeight: '700' },
  qrModeChip: {
    flex: 1, minWidth: '42%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 12, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: COLORS.borderDefault, backgroundColor: COLORS.pageBg,
  },
  qrModeChipActive: { borderColor: COLORS.brandPrimary, backgroundColor: COLORS.brandPrimary },
  qrModeChipTxt:    { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  qrModeChipTxtActive: { color: COLORS.white, fontWeight: '700' },
  fieldHint: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginBottom: 8, marginTop: 4, lineHeight: 16 },
  qrEmptyHint: {
    alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 20, marginBottom: 4,
    borderRadius: RADIUS.md, borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.borderDefault,
    backgroundColor: COLORS.pageBg,
  },
  qrEmptyHintTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, textAlign: 'center', paddingHorizontal: 16 },

  // PDF Preview button
  previewBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, flex: 1, minWidth: 0, borderWidth: 1.5, borderColor: COLORS.brandPrimary, borderRadius: RADIUS.lg, paddingVertical: 14, paddingHorizontal: 10, backgroundColor: COLORS.cardBg, overflow: 'hidden' },
  previewBtnTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.brandPrimary, flexShrink: 1 },


  // Use this format / Save All
  useBtn:        { backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.lg, paddingVertical: 14, alignItems: 'center' },
  useBtnSaving:  { backgroundColor: COLORS.borderStrong },
  useBtnTxt:     { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
  saveAllBtn:    { backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.lg, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  saveAllTxt:    { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});

// ── Compliance Sections Styles ─────────────────────────────────────────────────
const cs = StyleSheet.create({
  statusPill:     { flexShrink: 0, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  statusPillTxt:  { fontSize: TYPOGRAPHY.xs, fontWeight: '700' },
  sectionSub:     { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginBottom: 12 },
  optRow:         { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10, paddingHorizontal: 4, borderRadius: RADIUS.md, marginBottom: 4 },
  optRowActive:   { backgroundColor: COLORS.activeBg },
  optRadio:       { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: COLORS.borderStrong, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  optRadioDot:    { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.brandPrimary },
  optLabel:       { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 2 },
  optSub:         { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  warningBox:     { flexDirection: 'row', gap: 8, backgroundColor: '#FEF3C7', borderRadius: RADIUS.md, padding: 12, marginTop: 8, borderWidth: 1, borderColor: '#FCD34D' },
  warningTxt:     { flex: 1, fontSize: TYPOGRAPHY.xs, color: '#92400E' },
  modeRow:        { marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  modeLabel:      { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 8 },
  modeChips:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  modeChip:       { paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg },
  modeChipActive: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  modeChipTxt:    { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  modeChipTxtActive: { color: COLORS.white },
  configLink:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  configLinkTxt:  { fontSize: TYPOGRAPHY.sm, color: COLORS.brandPrimary, fontWeight: '600' },
  saveBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md, paddingVertical: 14, marginBottom: SPACING.md },
  saveBtnTxt:     { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});
