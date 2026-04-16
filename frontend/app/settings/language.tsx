import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

// ── Data ──────────────────────────────────────────────────────────────────────
const LANGUAGES = [
  { value: 'en', label: 'English',   native: 'English'    },
  { value: 'hi', label: 'Hindi',     native: 'हिन्दी'     },
  { value: 'gu', label: 'Gujarati',  native: 'ગુજરાતી'    },
  { value: 'mr', label: 'Marathi',   native: 'मराठी'      },
  { value: 'ta', label: 'Tamil',     native: 'தமிழ்'      },
  { value: 'te', label: 'Telugu',    native: 'తెలుగు'     },
  { value: 'kn', label: 'Kannada',   native: 'ಕನ್ನಡ'      },
  { value: 'pa', label: 'Punjabi',   native: 'ਪੰਜਾਬੀ'    },
  { value: 'bn', label: 'Bengali',   native: 'বাংলা'      },
  { value: 'ml', label: 'Malayalam', native: 'മലയാളം'    },
  { value: 'or', label: 'Odia',      native: 'ଓଡ଼ିଆ'      },
];

type TzOption = { value: string; label: string; offset: string };

const COUNTRY_TZ: Record<string, TzOption[]> = {
  'India':          [{ value: 'UTC+05:30 · Asia/Kolkata',              label: 'Asia/Kolkata',                  offset: 'UTC+05:30' }],
  'UAE':            [{ value: 'UTC+04:00 · Asia/Dubai',                label: 'Asia/Dubai',                    offset: 'UTC+04:00' }],
  'United Kingdom': [
    { value: 'UTC+00:00 · Europe/London (GMT)', label: 'Europe/London (GMT)', offset: 'UTC+00:00' },
    { value: 'UTC+01:00 · Europe/London (BST)', label: 'Europe/London (BST)', offset: 'UTC+01:00' },
  ],
  'United States': [
    { value: 'UTC-05:00 · America/New_York',    label: 'America/New_York (Eastern)',    offset: 'UTC-05:00' },
    { value: 'UTC-06:00 · America/Chicago',     label: 'America/Chicago (Central)',     offset: 'UTC-06:00' },
    { value: 'UTC-07:00 · America/Denver',      label: 'America/Denver (Mountain)',     offset: 'UTC-07:00' },
    { value: 'UTC-08:00 · America/Los_Angeles', label: 'America/Los_Angeles (Pacific)', offset: 'UTC-08:00' },
    { value: 'UTC-09:00 · America/Anchorage',   label: 'America/Anchorage (Alaska)',    offset: 'UTC-09:00' },
    { value: 'UTC-10:00 · Pacific/Honolulu',    label: 'Pacific/Honolulu (Hawaii)',     offset: 'UTC-10:00' },
  ],
  'Australia': [
    { value: 'UTC+10:00 · Australia/Sydney',    label: 'Australia/Sydney',    offset: 'UTC+10:00' },
    { value: 'UTC+10:00 · Australia/Melbourne', label: 'Australia/Melbourne', offset: 'UTC+10:00' },
    { value: 'UTC+10:00 · Australia/Brisbane',  label: 'Australia/Brisbane',  offset: 'UTC+10:00' },
    { value: 'UTC+09:30 · Australia/Adelaide',  label: 'Australia/Adelaide',  offset: 'UTC+09:30' },
    { value: 'UTC+08:00 · Australia/Perth',     label: 'Australia/Perth',     offset: 'UTC+08:00' },
    { value: 'UTC+09:30 · Australia/Darwin',    label: 'Australia/Darwin',    offset: 'UTC+09:30' },
  ],
  'Bahrain':       [{ value: 'UTC+03:00 · Asia/Bahrain',         label: 'Asia/Bahrain',        offset: 'UTC+03:00' }],
  'Kuwait':        [{ value: 'UTC+03:00 · Asia/Kuwait',          label: 'Asia/Kuwait',         offset: 'UTC+03:00' }],
  'Oman':          [{ value: 'UTC+04:00 · Asia/Muscat',          label: 'Asia/Muscat',         offset: 'UTC+04:00' }],
  'Qatar':         [{ value: 'UTC+03:00 · Asia/Qatar',           label: 'Asia/Qatar',          offset: 'UTC+03:00' }],
  'Saudi Arabia':  [{ value: 'UTC+03:00 · Asia/Riyadh',          label: 'Asia/Riyadh',         offset: 'UTC+03:00' }],
  'Singapore':     [{ value: 'UTC+08:00 · Asia/Singapore',       label: 'Asia/Singapore',      offset: 'UTC+08:00' }],
  'Malaysia':      [{ value: 'UTC+08:00 · Asia/Kuala_Lumpur',    label: 'Asia/Kuala_Lumpur',   offset: 'UTC+08:00' }],
  'South Africa':  [{ value: 'UTC+02:00 · Africa/Johannesburg',  label: 'Africa/Johannesburg', offset: 'UTC+02:00' }],
  'Bangladesh':    [{ value: 'UTC+06:00 · Asia/Dhaka',           label: 'Asia/Dhaka',          offset: 'UTC+06:00' }],
  'Nepal':         [{ value: 'UTC+05:45 · Asia/Kathmandu',       label: 'Asia/Kathmandu',      offset: 'UTC+05:45' }],
  'Sri Lanka':     [{ value: 'UTC+05:30 · Asia/Colombo',         label: 'Asia/Colombo',        offset: 'UTC+05:30' }],
  'Kenya':         [{ value: 'UTC+03:00 · Africa/Nairobi',       label: 'Africa/Nairobi',      offset: 'UTC+03:00' }],
  'Nigeria':       [{ value: 'UTC+01:00 · Africa/Lagos',         label: 'Africa/Lagos',        offset: 'UTC+01:00' }],
  'Tanzania':      [{ value: 'UTC+03:00 · Africa/Dar_es_Salaam', label: 'Africa/Dar_es_Salaam',offset: 'UTC+03:00' }],
  'New Zealand': [
    { value: 'UTC+12:00 · Pacific/Auckland', label: 'Pacific/Auckland', offset: 'UTC+12:00' },
    { value: 'UTC+12:45 · Pacific/Chatham',  label: 'Pacific/Chatham',  offset: 'UTC+12:45' },
  ],
  'Canada': [
    { value: 'UTC-05:00 · America/Toronto',   label: 'America/Toronto (Eastern)',  offset: 'UTC-05:00' },
    { value: 'UTC-06:00 · America/Winnipeg',  label: 'America/Winnipeg (Central)', offset: 'UTC-06:00' },
    { value: 'UTC-07:00 · America/Edmonton',  label: 'America/Edmonton (Mountain)',offset: 'UTC-07:00' },
    { value: 'UTC-08:00 · America/Vancouver', label: 'America/Vancouver (Pacific)',offset: 'UTC-08:00' },
    { value: 'UTC-04:00 · America/Halifax',   label: 'America/Halifax (Atlantic)', offset: 'UTC-04:00' },
  ],
  'Germany':  [{ value: 'UTC+01:00 · Europe/Berlin', label: 'Europe/Berlin', offset: 'UTC+01:00' }],
  'France':   [{ value: 'UTC+01:00 · Europe/Paris',  label: 'Europe/Paris',  offset: 'UTC+01:00' }],
  'Japan':    [{ value: 'UTC+09:00 · Asia/Tokyo',    label: 'Asia/Tokyo',    offset: 'UTC+09:00' }],
  'China':    [{ value: 'UTC+08:00 · Asia/Shanghai', label: 'Asia/Shanghai', offset: 'UTC+08:00' }],
};

const COUNTRIES  = Object.keys(COUNTRY_TZ).sort();
const WEEK_DAYS  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DATE_FMTS  = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', 'DD-MM-YYYY'];

// ── Generic Picker Bottom Sheet ───────────────────────────────────────────────
type PickerItem = { value: string; label: string; sublabel?: string };

function PickerSheet({ visible, title, items, selected, onSelect, onClose }: {
  visible: boolean;
  title: string;
  items: PickerItem[];
  selected: string;
  onSelect: (v: string) => void;
  onClose: () => void;
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

// ── Dropdown Trigger Field ─────────────────────────────────────────────────────
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

// ── Main Screen ───────────────────────────────────────────────────────────────
type ActivePicker = 'language' | 'country' | 'timezone' | 'weekday' | null;

export default function LanguageRegionScreen() {
  const router = useRouter();
  const [lang,       setLang]       = useState('en');
  const [country,    setCountry]    = useState('India');
  const [timezone,   setTimezone]   = useState('UTC+05:30 · Asia/Kolkata');
  const [weekday,    setWeekday]    = useState('Monday');
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');
  const [picker,     setPicker]     = useState<ActivePicker>(null);

  const langObj   = LANGUAGES.find(l => l.value === lang);
  const tzOptions = COUNTRY_TZ[country] || [];

  // When country changes, auto-select first timezone of that country
  const handleCountryChange = (c: string) => {
    setCountry(c);
    const tzs = COUNTRY_TZ[c] || [];
    if (tzs.length > 0) setTimezone(tzs[0].value);
  };

  const handleSave = () => {
    Toast.show({
      type: 'success',
      text1: 'Settings Saved',
      text2: 'Language & Region preferences updated.',
    });
  };

  // Build picker item arrays
  const langItems    = LANGUAGES.map(l => ({
    value: l.value,
    label: l.label,
    sublabel: l.native !== l.label ? l.native : undefined,
  }));
  const countryItems = COUNTRIES.map(c => ({ value: c, label: c }));
  const tzItems      = tzOptions.map(tz => ({ value: tz.value, label: tz.label, sublabel: tz.offset }));
  const dayItems     = WEEK_DAYS.map(d => ({ value: d, label: d }));

  const langDisplay = langObj
    ? (langObj.native !== langObj.label ? `${langObj.label} · ${langObj.native}` : langObj.label)
    : lang;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>

      {/* ── Header ── */}
      <View style={s.hdr}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.hdrTitle}>Language & Region</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── App Language ── */}
        <View style={s.card}>
          <View style={s.cardHdr}>
            <Ionicons name="language-outline" size={18} color={COLORS.textSecondary} />
            <Text style={s.cardTitle}>App Language</Text>
          </View>
          <DropdownField
            label="Language"
            value={langDisplay}
            onPress={() => setPicker('language')}
          />
        </View>

        {/* ── Region & Time ── */}
        <View style={s.card}>
          <View style={s.cardHdr}>
            <Ionicons name="globe-outline" size={18} color={COLORS.textSecondary} />
            <Text style={s.cardTitle}>Region & Time</Text>
          </View>
          <DropdownField
            label="Country"
            value={country}
            onPress={() => setPicker('country')}
          />
          <DropdownField
            label="Time Zone"
            value={timezone}
            onPress={() => setPicker('timezone')}
          />
          <DropdownField
            label="First Day of Week"
            value={weekday}
            onPress={() => setPicker('weekday')}
          />
        </View>

        {/* ── Date Format ── */}
        <View style={s.card}>
          <View style={s.cardHdr}>
            <Ionicons name="calendar-outline" size={18} color={COLORS.textSecondary} />
            <Text style={s.cardTitle}>Date Format</Text>
          </View>
          <View style={s.chips}>
            {DATE_FMTS.map(f => (
              <TouchableOpacity
                key={f}
                style={[s.chip, dateFormat === f && s.chipActive]}
                onPress={() => setDateFormat(f)}
                activeOpacity={0.75}
              >
                <Text style={[s.chipTxt, dateFormat === f && s.chipTxtActive]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Save ── */}
        <TouchableOpacity style={s.saveBtn} onPress={handleSave} activeOpacity={0.85}>
          <Text style={s.saveTxt}>Save Changes</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Bottom Sheet Pickers (siblings at root, never nested) ── */}
      <PickerSheet
        visible={picker === 'language'}
        title="Select Language"
        items={langItems}
        selected={lang}
        onSelect={setLang}
        onClose={() => setPicker(null)}
      />
      <PickerSheet
        visible={picker === 'country'}
        title="Select Country"
        items={countryItems}
        selected={country}
        onSelect={handleCountryChange}
        onClose={() => setPicker(null)}
      />
      <PickerSheet
        visible={picker === 'timezone'}
        title="Select Time Zone"
        items={tzItems}
        selected={timezone}
        onSelect={setTimezone}
        onClose={() => setPicker(null)}
      />
      <PickerSheet
        visible={picker === 'weekday'}
        title="First Day of Week"
        items={dayItems}
        selected={weekday}
        onSelect={setWeekday}
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
  chips:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:         { paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault },
  chipActive:   { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  chipTxt:      { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '500' },
  chipTxtActive:{ color: COLORS.white, fontWeight: '700' },
  saveBtn:      { backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.lg, paddingVertical: 16, alignItems: 'center' },
  saveTxt:      { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});
