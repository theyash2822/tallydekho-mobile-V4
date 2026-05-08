import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, Image, Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { getUserSettings, updateUserSettings, getBankLedgers, getCompanyLogo } from '../../src/services/api';
import { generateDocumentHTML } from '../../src/utils/documentHelpers';

// ── Data ──────────────────────────────────────────────────────────────────────
// Bank options are fetched from Tally (see useEffect in component)
const FALLBACK_BANK_OPTS = [
  { value: 'Cash', label: 'Cash' },
];

const VOUCHER_TYPES = [
  { id: 'sales_inv',      label: 'Sales Invoice',    icon: 'receipt-outline'          },
  { id: 'purchase_inv',   label: 'Purchase Invoice',  icon: 'cart-outline'             },
  { id: 'sales_order',    label: 'Sales Order',       icon: 'bag-outline'              },
  { id: 'purchase_order', label: 'Purchase Order',    icon: 'cube-outline'             },
  { id: 'quotation',      label: 'Quotation',         icon: 'document-text-outline'    },
  { id: 'credit_note',    label: 'Credit Note',       icon: 'arrow-undo-outline'       },
  { id: 'debit_note',     label: 'Debit Note',        icon: 'arrow-redo-outline'       },
  { id: 'delivery_note',  label: 'Delivery Note',     icon: 'bicycle-outline'          },
];

const DEFAULT_TERMS: Record<string, string[]> = {
  sales_inv:      ['Payment due within 30 days of invoice date.', 'Goods once sold will not be returned without prior approval.'],
  purchase_inv:   ['All payments subject to receipt and verification of goods.', 'Disputes must be raised within 7 days of receipt.'],
  sales_order:    ['Order confirmation required within 48 hours.', 'Prices are valid for 7 days from order date.'],
  purchase_order: ['Delivery must match PO specifications exactly.', 'Advance payment required before dispatch.'],
  quotation:      ['This quotation is valid for 15 days from issue date.', 'Prices are subject to change without prior notice.'],
  credit_note:    ['Credit to be adjusted against next invoice.', 'Credit is non-refundable and non-transferable.'],
  debit_note:     ['Debit note raised against purchase invoice reference.', 'Amount payable within 15 days of issue.'],
  delivery_note:  ['Goods dispatched as per order specifications.', 'Recipient must verify quantity and condition on delivery.'],
};

interface VConfig {
  format:    1 | 2 | 3;
  bank:      string;
  qrEnabled: boolean;
  qrImage:   string | null;
  terms:     string[];
  qrType:    'upi' | 'url' | 'bank'; // UPI ID, website URL, or bank details
  qrUpiId:   string;
  qrUrl:     string;
  qrIfsc:    string;
  qrAccount: string;
}

const makeDefault = (id: string): VConfig => ({
  format: 1, bank: 'Cash', qrEnabled: false, qrImage: null,
  terms: DEFAULT_TERMS[id] ?? [],
  qrType: 'upi', qrUpiId: '', qrUrl: '', qrIfsc: '', qrAccount: '',
});

const VOUCHER_CONFIG_KEY = 'voucherConfig';

// ── Format Thumbnail (mini PDF preview) ───────────────────────────────────────
function FormatThumb({ type }: { type: 1 | 2 | 3 }) {
  const L = StyleSheet.create({
    doc:   { width: '100%', aspectRatio: 0.75, backgroundColor: '#FAFAFA', padding: 6, borderRadius: 2 },
    ln:    { height: 2, backgroundColor: '#D4D4D4', borderRadius: 1 },
    div:   { height: 1, backgroundColor: '#E8E8E8', marginVertical: 3 },
    row:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 1.5 },
    sq:    { width: 14, height: 14, borderRadius: 2, backgroundColor: '#DADADA' },
    smSq:  { width: 10, height: 10, borderRadius: 1, backgroundColor: '#DADADA' },
    circ:  { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: '#D4D4D4' },
  });

  if (type === 1) return (
    <View style={L.doc}>
      {/* Classic: logo left + company lines right */}
      <View style={L.row}><View style={L.sq} /><View style={{ flex: 1, marginLeft: 4, gap: 2 }}><View style={[L.ln, { width: '90%' }]} /><View style={[L.ln, { width: '65%' }]} /></View></View>
      <View style={L.div} />
      <View style={L.row}><View style={[L.ln, { width: '38%' }]} /><View style={[L.ln, { width: '30%' }]} /></View>
      <View style={L.div} />
      {[0,1,2].map(i => <View key={i} style={L.row}><View style={[L.ln, { width: '6%' }]} /><View style={[L.ln, { width: '48%' }]} /><View style={[L.ln, { width: '18%' }]} /></View>)}
      <View style={L.div} />
      <View style={{ alignItems: 'flex-end' }}><View style={[L.ln, { width: '28%', height: 3 }]} /></View>
    </View>
  );

  if (type === 2) return (
    <View style={L.doc}>
      {/* Modern: full-width dark header */}
      <View style={{ height: 14, backgroundColor: '#1A1A1A', borderRadius: 1, marginBottom: 4 }} />
      <View style={{ alignItems: 'center', marginBottom: 3 }}><View style={[L.ln, { width: '55%' }]} /></View>
      <View style={L.div} />
      <View style={L.row}><View style={{ gap: 2 }}><View style={[L.ln, { width: 38 }]} /><View style={[L.ln, { width: 28 }]} /></View><View style={{ gap: 2 }}><View style={[L.ln, { width: 38 }]} /><View style={[L.ln, { width: 28 }]} /></View></View>
      <View style={L.div} />
      {[0,1,2].map(i => <View key={i} style={L.row}><View style={[L.ln, { width: '6%' }]} /><View style={[L.ln, { width: '48%' }]} /><View style={[L.ln, { width: '18%' }]} /></View>)}
      <View style={{ alignItems: 'flex-end', marginTop: 2 }}><View style={[L.ln, { width: '30%', height: 3 }]} /></View>
    </View>
  );

  return (
    <View style={L.doc}>
      {/* Detailed: split header, table, footer stamp */}
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
  const [bankPickerFor, setBankPickerFor] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const markDirty = () => setIsDirty(true);
  const [saving,        setSaving]        = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const companyLogoRef = useRef<string | null>(null);

  // Load bank ledgers from Tally on mount
  useEffect(() => {
    if (!company?.guid) return;
    getBankLedgers(company.guid).then((res: any) => {
      if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
        const opts = [
          ...res.data.map((b: any) => ({ value: b.name, label: b.name })),
          { value: 'Cash', label: 'Cash' },
        ];
        setBankOpts(opts);
      }
    }).catch(() => {});
  }, [company?.guid]);

  // Load company logo for PDF preview
  useEffect(() => {
    if (!company?.guid) return;
    const key = `company_logo_${company.guid}`;
    getCompanyLogo(company.guid).then((res: any) => {
      const url = res?.data?.logo_url;
      if (url) { companyLogoRef.current = url; }
      else {
        AsyncStorage.getItem(key).then(uri => { if (uri) companyLogoRef.current = uri; }).catch(() => {});
      }
    }).catch(() => {
      AsyncStorage.getItem(key).then(uri => { if (uri) companyLogoRef.current = uri; }).catch(() => {});
    });
  }, [company?.guid]);

  // Load persisted config: backend first, AsyncStorage fallback
  useEffect(() => {
    const applyParsed = (parsed: any) => {
      setConfigs(prev => {
        const merged: Record<string, VConfig> = { ...prev };
        Object.keys(parsed).forEach(k => {
          if (merged[k]) merged[k] = { ...merged[k], ...parsed[k] };
        });
        return merged;
      });
    };

    getUserSettings().then((res: any) => {
      const serverConfig = res?.data?.voucher_config;
      if (serverConfig) {
        try {
          const parsed = typeof serverConfig === 'string' ? JSON.parse(serverConfig) : serverConfig;
          applyParsed(parsed);
          AsyncStorage.setItem(VOUCHER_CONFIG_KEY, JSON.stringify(parsed)).catch(() => {});
        } catch {}
      } else {
        // No server config yet — try AsyncStorage cache
        AsyncStorage.getItem(VOUCHER_CONFIG_KEY).then(stored => {
          if (stored) { try { applyParsed(JSON.parse(stored)); } catch {} }
        }).catch(() => {});
      }
    }).catch(() => {
      // Backend failed — fallback to AsyncStorage
      AsyncStorage.getItem(VOUCHER_CONFIG_KEY).then(stored => {
        if (stored) { try { applyParsed(JSON.parse(stored)); } catch {} }
      }).catch(() => {});
    });
  }, []);

  const update = (id: string, key: keyof VConfig, val: any) =>
    setConfigs(prev => ({ ...prev, [id]: { ...prev[id], [key]: val } }));

  const updateTerm = (id: string, idx: number, text: string) =>
    setConfigs(prev => ({ ...prev, [id]: { ...prev[id], terms: prev[id].terms.map((t, i) => i === idx ? text : t) } }));

  const removeTerm = (id: string, idx: number) =>
    setConfigs(prev => ({ ...prev, [id]: { ...prev[id], terms: prev[id].terms.filter((_, i) => i !== idx) } }));

  const addTerm = (id: string) =>
    setConfigs(prev => ({ ...prev, [id]: { ...prev[id], terms: [...prev[id].terms, ''] } }));

  const handlePickQR = async (id: string) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({ type: 'error', text1: 'Permission Required', text2: 'Please allow photo library access.' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8, base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
      update(id, 'qrImage', uri);
    }
  };

  const handleUseFormat = async (id: string, label: string, format: number) => {
    setSaving(id);
    try {
      const updated = { ...configs, [id]: { ...configs[id], format: format as 1 | 2 | 3 } };
      setConfigs(updated);
      await AsyncStorage.setItem(VOUCHER_CONFIG_KEY, JSON.stringify(updated));
      // Sync to backend
      await updateUserSettings({ voucher_config: updated }).catch(() => {});
      Toast.show({ type: 'success', text1: `${label} Updated`, text2: `Format ${format} applied and saved.` });
    } catch {
      Toast.show({ type: 'error', text1: 'Save Failed', text2: 'Could not save format selection.' });
    } finally {
      setSaving(null);
    }
  };

  const handleSaveAll = async () => {
    await AsyncStorage.setItem(VOUCHER_CONFIG_KEY, JSON.stringify(configs));
    // Sync to backend
    await updateUserSettings({ voucher_config: configs }).catch(() => {});
    setIsDirty(false);
    Toast.show({ type: 'success', text1: 'All Configurations Saved', text2: 'Voucher settings updated for all types.' });
  };

  const handlePDFPreview = async (id: string, label: string) => {
    setPreviewLoading(id);
    try {
      const cfg = configs[id];
      // Build a realistic sample document for preview
      const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      const sampleDoc: any = {
        documentType: id === 'purchase_inv' ? 'purchase_invoice'
          : id === 'sales_order' ? 'sales_order'
          : id === 'purchase_order' ? 'purchase_order'
          : id === 'quotation' ? 'quotation'
          : id === 'credit_note' ? 'credit_note'
          : id === 'debit_note' ? 'debit_note'
          : id === 'delivery_note' ? 'delivery_note'
          : 'sales_invoice',
        documentNumber: 'SMPL/2425/001',
        date: today,
        reference: '',
        company: {
          name: company?.name || 'Your Company',
          address: 'Mumbai, Maharashtra',
          gstin: company?.gstin || '27AAJCR0000E1Z2',
          state: 'Maharashtra',
        },
        party: { name: 'Sample Customer', address: 'Delhi, India', gstin: '07AABCD1234E1ZP' },
        items: [
          { name: 'Sample Product A', hsn: '8471', qty: 10, unit: 'PCS', rate: 500, discount: 0, amount: 5000 },
          { name: 'Sample Product B', hsn: '8517', qty: 5,  unit: 'PCS', rate: 1200, discount: 0, amount: 6000 },
        ],
        ledgerEntries: [],
        totals: { subtotal: 11000, discount: 0, taxableAmount: 11000, cgstTotal: 990, sgstTotal: 990, igstTotal: 0, taxTotal: 1980, roundOff: 0, total: 12980, balanceDue: 12980 },
        taxes: [{ name: 'GST 18%', taxableAmount: 11000, cgst: 990, sgst: 990, igst: 0, total: 1980 }],
        narration: 'Sample preview document',
        terms: cfg.terms.join('\n'),
        bankDetails: null,
      };
      const html = generateDocumentHTML(sampleDoc, companyLogoRef.current, cfg.format, cfg.terms);
      const { uri } = await Print.printToFileAsync({ html, base64: false, width: 595, height: 842 });
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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Text style={s.subtitle}>Configure PDF format and settings for each voucher type</Text>

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
                      {([1, 2, 3] as const).map(fmt => (
                        <TouchableOpacity
                          key={fmt}
                          style={[s.formatCard, cfg.format === fmt && s.formatCardActive]}
                          onPress={() => update(vt.id, 'format', fmt)}
                          activeOpacity={0.8}
                        >
                          {cfg.format === fmt && (
                            <View style={s.formatBadge}>
                              <Ionicons name="checkmark" size={10} color={COLORS.white} />
                            </View>
                          )}
                          <FormatThumb type={fmt} />
                          <Text style={[s.formatLbl, cfg.format === fmt && s.formatLblActive]}>
                            Format {fmt}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

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

                    {/* QR Type Selector */}
                    {cfg.qrEnabled && (
                      <View style={s.qrTypeRow}>
                        {([{ v: 'upi', l: 'UPI ID' }, { v: 'url', l: 'Website' }, { v: 'bank', l: 'Bank Details' }] as const).map(opt => (
                          <TouchableOpacity
                            key={opt.v}
                            style={[s.qrTypeChip, cfg.qrType === opt.v && s.qrTypeChipActive]}
                            onPress={() => update(vt.id, 'qrType', opt.v)}
                            activeOpacity={0.7}
                          >
                            <Text style={[s.qrTypeChipTxt, cfg.qrType === opt.v && s.qrTypeChipTxtActive]}>{opt.l}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    {cfg.qrEnabled && cfg.qrType === 'upi' && (
                      <TextInput
                        style={s.termInput}
                        value={cfg.qrUpiId}
                        onChangeText={t => update(vt.id, 'qrUpiId', t)}
                        placeholder="Enter UPI ID (e.g. business@upi)"
                        placeholderTextColor={COLORS.textTertiary}
                        autoCapitalize="none"
                        keyboardType="email-address"
                      />
                    )}
                    {cfg.qrEnabled && cfg.qrType === 'url' && (
                      <TextInput
                        style={s.termInput}
                        value={cfg.qrUrl}
                        onChangeText={t => update(vt.id, 'qrUrl', t)}
                        placeholder="Enter website URL (e.g. https://yoursite.com)"
                        placeholderTextColor={COLORS.textTertiary}
                        autoCapitalize="none"
                        keyboardType="url"
                      />
                    )}
                    {cfg.qrEnabled && cfg.qrType === 'bank' && (
                      <View style={{ gap: 8 }}>
                        <TextInput
                          style={s.termInput}
                          value={cfg.qrIfsc}
                          onChangeText={t => update(vt.id, 'qrIfsc', t.toUpperCase())}
                          placeholder="IFSC Code (e.g. HDFC0001234)"
                          placeholderTextColor={COLORS.textTertiary}
                          autoCapitalize="characters"
                        />
                        <TextInput
                          style={s.termInput}
                          value={cfg.qrAccount}
                          onChangeText={t => update(vt.id, 'qrAccount', t)}
                          placeholder="Account Number"
                          placeholderTextColor={COLORS.textTertiary}
                          keyboardType="numeric"
                        />
                      </View>
                    )}

                    {cfg.qrEnabled && (
                      cfg.qrImage ? (
                        /* QR Preview Card */
                        <View style={s.qrPreviewCard}>
                          <Image source={{ uri: cfg.qrImage }} style={s.qrPreviewImg} resizeMode="contain" />
                          <View style={s.qrPreviewFooter}>
                            <View style={s.qrPreviewStatus}>
                              <Ionicons name="checkmark-circle" size={14} color={COLORS.brandPrimary} />
                              <Text style={s.qrPreviewStatusTxt}>QR code ready for PDF</Text>
                            </View>
                            <TouchableOpacity onPress={() => update(vt.id, 'qrImage', null)} activeOpacity={0.7} style={s.qrRemoveBtn}>
                              <Ionicons name="trash-outline" size={13} color={COLORS.negative} />
                              <Text style={s.qrRemoveTxt}>Remove</Text>
                            </TouchableOpacity>
                          </View>
                          {/* Re-upload option */}
                          <TouchableOpacity style={s.qrReuploadBtn} onPress={() => handlePickQR(vt.id)} activeOpacity={0.7}>
                            <Ionicons name="refresh-outline" size={14} color={COLORS.textSecondary} />
                            <Text style={s.qrReuploadTxt}>Replace QR</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        /* Upload Zone */
                        <TouchableOpacity style={s.uploadZone} onPress={() => handlePickQR(vt.id)} activeOpacity={0.7}>
                          <Ionicons name="cloud-upload-outline" size={28} color={COLORS.textTertiary} />
                          <Text style={s.uploadMainTxt}>Upload QR Code Image</Text>
                          <Text style={s.uploadSubTxt}>Tap to select from gallery · PNG or JPG</Text>
                        </TouchableOpacity>
                      )
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
                      <Ionicons name="document-outline" size={16} color={COLORS.brandPrimary} />
                      <Text style={s.previewBtnTxt}>{previewLoading === vt.id ? 'Generating...' : 'PDF Preview'}</Text>
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

  // QR type chips
  qrTypeRow:        { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  qrTypeChip:       { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full, borderWidth: 1.5, borderColor: COLORS.borderDefault, backgroundColor: COLORS.pageBg },
  qrTypeChipActive: { borderColor: COLORS.brandPrimary, backgroundColor: COLORS.brandPrimary },
  qrTypeChipTxt:    { fontSize: TYPOGRAPHY.sm, fontWeight: '500', color: COLORS.textSecondary },
  qrTypeChipTxtActive: { color: COLORS.white, fontWeight: '700' },

  // PDF Preview button
  previewBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, flex: 1, borderWidth: 1.5, borderColor: COLORS.brandPrimary, borderRadius: RADIUS.lg, paddingVertical: 14, backgroundColor: COLORS.cardBg },
  previewBtnTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.brandPrimary },

  // Use this format / Save All
  useBtn:        { backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.lg, paddingVertical: 14, alignItems: 'center' },
  useBtnSaving:  { backgroundColor: COLORS.borderStrong },
  useBtnTxt:     { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
  saveAllBtn:    { backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.lg, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  saveAllTxt:    { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});
