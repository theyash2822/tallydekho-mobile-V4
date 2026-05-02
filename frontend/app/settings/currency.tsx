import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useSettings } from '../../src/context/SettingsContext';

// Map internal keys to SettingsContext values
const DATE_TO_CONTEXT: Record<string, string> = {
  dmy: 'DD/MM/YYYY',
  dmy2: 'DD/MM/YYYY',
  mdy: 'MM/DD/YYYY',
  ymd: 'YYYY-MM-DD',
};
const DATE_FROM_CONTEXT: Record<string, string> = {
  'DD/MM/YYYY': 'dmy',
  'MM/DD/YYYY': 'mdy',
  'YYYY-MM-DD': 'ymd',
};
const NUM_TO_CONTEXT: Record<string, string> = {
  in: 'Indian',
  int: 'International',
  eu: 'International',
  fr: 'International',
};

// ── Data ──────────────────────────────────────────────────────────────────────
const CURRENCIES = [
  { value: 'AED', label: 'AED – UAE Dirham (د.إ)',           sublabel: 'UAE',             symbol: 'د.إ' },
  { value: 'AUD', label: 'AUD – Australian Dollar (A$)',     sublabel: 'Australia',       symbol: 'A$'  },
  { value: 'BDT', label: 'BDT – Bangladeshi Taka (৳)',       sublabel: 'Bangladesh',      symbol: '৳'   },
  { value: 'BHD', label: 'BHD – Bahraini Dinar (BD)',        sublabel: 'Bahrain',         symbol: 'BD'  },
  { value: 'CAD', label: 'CAD – Canadian Dollar (C$)',       sublabel: 'Canada',          symbol: 'C$'  },
  { value: 'CNY', label: 'CNY – Chinese Yuan (¥)',           sublabel: 'China',           symbol: '¥'   },
  { value: 'EUR', label: 'EUR – Euro (€)',                   sublabel: 'Germany / France',symbol: '€'   },
  { value: 'GBP', label: 'GBP – British Pound (£)',          sublabel: 'United Kingdom',  symbol: '£'   },
  { value: 'INR', label: 'INR – Indian Rupee (₹)',           sublabel: 'India',           symbol: '₹'   },
  { value: 'JPY', label: 'JPY – Japanese Yen (¥)',           sublabel: 'Japan',           symbol: '¥'   },
  { value: 'KES', label: 'KES – Kenyan Shilling (KSh)',      sublabel: 'Kenya',           symbol: 'KSh' },
  { value: 'KWD', label: 'KWD – Kuwaiti Dinar (KD)',         sublabel: 'Kuwait',          symbol: 'KD'  },
  { value: 'LKR', label: 'LKR – Sri Lankan Rupee (Rs)',      sublabel: 'Sri Lanka',       symbol: 'Rs'  },
  { value: 'MYR', label: 'MYR – Malaysian Ringgit (RM)',     sublabel: 'Malaysia',        symbol: 'RM'  },
  { value: 'NGN', label: 'NGN – Nigerian Naira (₦)',         sublabel: 'Nigeria',         symbol: '₦'   },
  { value: 'NPR', label: 'NPR – Nepalese Rupee (रू)',        sublabel: 'Nepal',           symbol: 'रू'  },
  { value: 'NZD', label: 'NZD – New Zealand Dollar (NZ$)',   sublabel: 'New Zealand',     symbol: 'NZ$' },
  { value: 'OMR', label: 'OMR – Omani Rial (﷼)',             sublabel: 'Oman',            symbol: '﷼'   },
  { value: 'QAR', label: 'QAR – Qatari Riyal (QR)',          sublabel: 'Qatar',           symbol: 'QR'  },
  { value: 'SAR', label: 'SAR – Saudi Riyal (SR)',           sublabel: 'Saudi Arabia',    symbol: 'SR'  },
  { value: 'SGD', label: 'SGD – Singapore Dollar (S$)',      sublabel: 'Singapore',       symbol: 'S$'  },
  { value: 'TZS', label: 'TZS – Tanzanian Shilling (TSh)',   sublabel: 'Tanzania',        symbol: 'TSh' },
  { value: 'USD', label: 'USD – US Dollar ($)',              sublabel: 'United States',   symbol: '$'   },
  { value: 'ZAR', label: 'ZAR – South African Rand (R)',     sublabel: 'South Africa',    symbol: 'R'   },
];

const DATE_STYLES = [
  { value: 'dmy',  label: 'DD/MM/YYYY'  },
  { value: 'mdy',  label: 'MM/DD/YYYY'  },
  { value: 'ymd',  label: 'YYYY-MM-DD'  },
  { value: 'dmy2', label: 'DD-MM-YYYY'  },
];

const TIME_STYLES = [
  { value: '24h', label: '24-hour', sublabel: '14:30' },
  { value: '12h', label: '12-hour', sublabel: '2:30 PM' },
];

const THOUSANDS = [
  { value: 'in',  label: '12,34,567.89 (Indian)',        sublabel: '2-2-3 grouping · dot decimal'    },
  { value: 'int', label: '1,234,567.89 (International)', sublabel: '3-3-3 grouping · dot decimal'    },
  { value: 'eu',  label: '1.234.567,89 (European)',      sublabel: '3-3-3 grouping · comma decimal'  },
  { value: 'fr',  label: '12 34 567,89 (French)',        sublabel: 'Space grouping · comma decimal'  },
];

const NEGATIVE_STYLES = [
  { value: 'minus', label: '-1234 (Minus sign)',    sublabel: 'Standard prefix'          },
  { value: 'paren', label: '(1234) (Parentheses)', sublabel: 'Accounting style'         },
  { value: 'trail', label: '1234- (Trailing)',      sublabel: 'Minus suffix'             },
  { value: 'crdr',  label: '1234 CR (Credit/DR)',   sublabel: 'TallyPrime ledger style'  },
];

// ── Live Preview Helper ───────────────────────────────────────────────────────
const CURRENCY_SYMBOLS: Record<string, string> = {
  AED:'د.إ', AUD:'A$', BDT:'৳', BHD:'BD', CAD:'C$', CNY:'¥', EUR:'€',
  GBP:'£',  INR:'₹',  JPY:'¥',  KES:'KSh',KWD:'KD', LKR:'Rs', MYR:'RM',
  NGN:'₦',  NPR:'रू', NZD:'NZ$',OMR:'﷼',  QAR:'QR', SAR:'SR', SGD:'S$',
  TZS:'TSh',USD:'$',  ZAR:'R',
};

const DEC_SAMPLE = '89123'; // sample decimal digits

function buildPreview(currCode: string, sep: string, dec: number): string {
  const sym = CURRENCY_SYMBOLS[currCode] || currCode;
  const d   = dec > 0 ? DEC_SAMPLE.slice(0, dec) : '';
  switch (sep) {
    case 'in':  return `${sym} 12,34,567${d ? '.' + d : ''}`;
    case 'int': return `${sym} 1,234,567${d ? '.' + d : ''}`;
    case 'eu':  return `${sym} 1.234.567${d ? ',' + d : ''}`;
    case 'fr':  return `${sym} 12 34 567${d ? ',' + d : ''}`;
    default:    return `${sym} 1,234,567${d ? '.' + d : ''}`;
  }
}

// ── Generic Picker Bottom Sheet ───────────────────────────────────────────────
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
                <TouchableOpacity
                  key={item.value}
                  style={[pk.row, active && pk.rowActive]}
                  onPress={() => { onSelect(item.value); onClose(); }}
                  activeOpacity={0.7}
                >
                  <View style={pk.rowLeft}>
                    <Text style={[pk.rowLabel, active && pk.rowLabelActive]}>{item.label}</Text>
                    {item.sublabel ? (
                      <Text style={[pk.rowSub, active && pk.rowSubActive]}>{item.sublabel}</Text>
                    ) : null}
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
  sheet:         { backgroundColor: COLORS.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: SPACING.md, paddingTop: 12, maxHeight: '78%' },
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

// ── Dropdown Trigger Field ────────────────────────────────────────────────────
function DropdownField({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <View style={df.wrap}>
      <Text style={df.label}>{label}</Text>
      <TouchableOpacity style={df.trigger} onPress={onPress} activeOpacity={0.75}>
        <Text style={df.value} numberOfLines={1}>{value}</Text>
        <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}
const df = StyleSheet.create({
  wrap:    {},
  label:   { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textTertiary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  trigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, paddingHorizontal: 14, paddingVertical: 13 },
  value:   { flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '500', color: COLORS.textPrimary, marginRight: 8 },
});

// ── Helper ────────────────────────────────────────────────────────────────────
function getLabel(items: PickerItem[], value: string): string {
  return items.find(i => i.value === value)?.label || value;
}

// ── Main Screen ───────────────────────────────────────────────────────────────
type ActivePicker = 'currency' | 'dateStyle' | 'timeStyle' | 'thousands' | 'negStyle' | null;

export default function CurrencyScreen() {
  const router   = useRouter();
  const { settings, updateSettings } = useSettings();
  const [currency,  setCurrency]  = useState(settings.currency || 'INR');
  const [dateStyle, setDateStyle] = useState(DATE_FROM_CONTEXT[settings.date_format] || 'dmy');
  const [isDirty, setIsDirty] = useState(false);
  const markDirty = () => setIsDirty(true);
  const [timeStyle, setTimeStyle] = useState('24h');
  const [thousands, setThousands] = useState(settings.number_format === 'International' ? 'int' : 'in');
  const [negStyle,  setNegStyle]  = useState('minus');
  const [decimals,  setDecimals]  = useState(settings.decimal_places ?? 2);
  const [picker,    setPicker]    = useState<ActivePicker>(null);

  const preview = buildPreview(currency, thousands, decimals);

  const handleSave = async () => {
    await updateSettings({
      currency,
      number_format: NUM_TO_CONTEXT[thousands] || 'Indian',
      date_format: DATE_TO_CONTEXT[dateStyle] || 'DD/MM/YYYY',
      decimal_places: decimals,
    });
    setIsDirty(false);
    Toast.show({
      type: 'success',
      text1: 'Settings Saved',
      text2: 'Currency & Number Format updated.',
    });
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>

      {/* ── Header ── */}
      <View style={s.hdr}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.hdrTitle}>Currency & Number Format</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── 💰 Currency ── */}
        <View style={s.card}>
          <View style={s.cardHdr}>
            <Ionicons name="cash-outline" size={18} color={COLORS.textSecondary} />
            <Text style={s.cardTitle}>Currency</Text>
          </View>
          <DropdownField
            label="Currency"
            value={getLabel(CURRENCIES, currency)}
            onPress={() => setPicker('currency')}
          />
        </View>

        {/* ── 📅 Date & Time Format ── */}
        <View style={s.card}>
          <View style={s.cardHdr}>
            <Ionicons name="calendar-outline" size={18} color={COLORS.textSecondary} />
            <Text style={s.cardTitle}>Date & Time Format</Text>
          </View>
          <DropdownField
            label="Date Style"
            value={getLabel(DATE_STYLES, dateStyle)}
            onPress={() => setPicker('dateStyle')}
          />
          <DropdownField
            label="Time Style"
            value={getLabel(TIME_STYLES, timeStyle)}
            onPress={() => setPicker('timeStyle')}
          />
        </View>

        {/* ── 🔢 Number Formatting ── */}
        <View style={s.card}>
          <View style={s.cardHdr}>
            <Ionicons name="calculator-outline" size={18} color={COLORS.textSecondary} />
            <Text style={s.cardTitle}>Number Formatting</Text>
          </View>
          <DropdownField
            label="Thousands Separator"
            value={getLabel(THOUSANDS, thousands)}
            onPress={() => setPicker('thousands')}
          />
          <DropdownField
            label="Negative Numbers"
            value={getLabel(NEGATIVE_STYLES, negStyle)}
            onPress={() => setPicker('negStyle')}
          />

          {/* Decimal Places — merged with live preview */}
          <View style={s.decWrap}>
            <Text style={df.label}>Decimal Places</Text>
            <View style={s.decPill}>
              {/* Minus button */}
              <TouchableOpacity
                style={[s.decBtn, s.decBtnLeft]}
                onPress={() => setDecimals(d => Math.max(0, d - 1))}
                disabled={decimals === 0}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="remove"
                  size={20}
                  color={decimals === 0 ? COLORS.textTertiary : COLORS.brandPrimary}
                />
              </TouchableOpacity>

              {/* Live preview center */}
              <View style={s.decCenter}>
                <Text style={s.decPreviewNum} numberOfLines={1} adjustsFontSizeToFit>
                  {preview}
                </Text>
                <Text style={s.decCount}>{decimals} decimal place{decimals !== 1 ? 's' : ''}</Text>
              </View>

              {/* Plus button */}
              <TouchableOpacity
                style={[s.decBtn, s.decBtnRight]}
                onPress={() => setDecimals(d => Math.min(4, d + 1))}
                disabled={decimals === 4}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="add"
                  size={20}
                  color={decimals === 4 ? COLORS.textTertiary : COLORS.brandPrimary}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Save */}
        <TouchableOpacity style={s.saveBtn} onPress={handleSave} activeOpacity={0.85}>
          <Text style={s.saveTxt}>Save Changes</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Pickers (siblings at root, never nested) ── */}
      <PickerSheet
        visible={picker === 'currency'}
        title="Select Currency"
        items={CURRENCIES}
        selected={currency}
        onSelect={setCurrency}
        onClose={() => setPicker(null)}
      />
      <PickerSheet
        visible={picker === 'dateStyle'}
        title="Date Style"
        items={DATE_STYLES}
        selected={dateStyle}
        onSelect={setDateStyle}
        onClose={() => setPicker(null)}
      />
      <PickerSheet
        visible={picker === 'timeStyle'}
        title="Time Style"
        items={TIME_STYLES}
        selected={timeStyle}
        onSelect={setTimeStyle}
        onClose={() => setPicker(null)}
      />
      <PickerSheet
        visible={picker === 'thousands'}
        title="Thousands Separator"
        items={THOUSANDS}
        selected={thousands}
        onSelect={setThousands}
        onClose={() => setPicker(null)}
      />
      <PickerSheet
        visible={picker === 'negStyle'}
        title="Negative Numbers Style"
        items={NEGATIVE_STYLES}
        selected={negStyle}
        onSelect={setNegStyle}
        onClose={() => setPicker(null)}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: COLORS.pageBg },
  hdr:          { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  backBtn:      { width: 40, alignItems: 'flex-start' },
  hdrTitle:     { flex: 1, fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  scroll:       { padding: SPACING.md, gap: SPACING.md },
  card:         { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault, gap: SPACING.md },
  cardHdr:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle:    { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },

  // Decimal + Preview merged pill
  decWrap:      {},
  decPill:      { flexDirection: 'row', alignItems: 'stretch', backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  decBtn:       { width: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.cardBg, paddingVertical: 14 },
  decBtnLeft:   { borderRightWidth: 1, borderRightColor: COLORS.borderDefault },
  decBtnRight:  { borderLeftWidth: 1, borderLeftColor: COLORS.borderDefault },
  decCenter:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 8, gap: 3 },
  decPreviewNum:{ fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center' },
  decCount:     { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, textAlign: 'center' },

  saveBtn:      { backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.lg, paddingVertical: 16, alignItems: 'center' },
  saveTxt:      { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});
