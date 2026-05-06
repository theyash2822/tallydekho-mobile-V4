import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useSettings } from '../../src/context/SettingsContext';
import { useAuth } from '../../src/context/AuthContext';
import { useTranslation } from 'react-i18next';

// ── Country detection from phone country code ─────────────────────────────────
const PHONE_PREFIX_TO_COUNTRY: Record<string, string> = {
  '91':  'India',
  '971': 'UAE',
  '1':   'United States',
  '44':  'United Kingdom',
  '61':  'Australia',
  '65':  'Singapore',
  '60':  'Malaysia',
  '966': 'Saudi Arabia',
  '974': 'Qatar',
  '973': 'Bahrain',
  '968': 'Oman',
  '965': 'Kuwait',
  '27':  'South Africa',
  '254': 'Kenya',
  '234': 'Nigeria',
  '255': 'Tanzania',
  '64':  'New Zealand',
  '49':  'Germany',
  '33':  'France',
  '81':  'Japan',
  '86':  'China',
  '880': 'Bangladesh',
  '977': 'Nepal',
  '94':  'Sri Lanka',
};

// Order matters — longer prefixes first to avoid '1' matching before '1xxx'
const SORTED_PREFIXES = Object.keys(PHONE_PREFIX_TO_COUNTRY).sort((a, b) => b.length - a.length);

function detectCountryFromPhone(phone?: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  const normalized = digits.replace(/^0+/, '');
  for (const prefix of SORTED_PREFIXES) {
    if (normalized.startsWith(prefix)) {
      return PHONE_PREFIX_TO_COUNTRY[prefix];
    }
  }
  return null;
}

// ── Country → currency + number format defaults ───────────────────────────────
const COUNTRY_DEFAULTS: Record<string, { currency: string; number_format: string }> = {
  'India':          { currency: 'INR', number_format: 'Indian' },
  'UAE':            { currency: 'AED', number_format: 'International' },
  'United States':  { currency: 'USD', number_format: 'International' },
  'United Kingdom': { currency: 'GBP', number_format: 'International' },
  'Australia':      { currency: 'AUD', number_format: 'International' },
  'Singapore':      { currency: 'SGD', number_format: 'International' },
  'Malaysia':       { currency: 'MYR', number_format: 'International' },
  'Saudi Arabia':   { currency: 'SAR', number_format: 'International' },
  'Qatar':          { currency: 'QAR', number_format: 'International' },
  'Bahrain':        { currency: 'BHD', number_format: 'International' },
  'Oman':           { currency: 'OMR', number_format: 'International' },
  'Kuwait':         { currency: 'KWD', number_format: 'International' },
  'South Africa':   { currency: 'ZAR', number_format: 'International' },
  'Kenya':          { currency: 'KES', number_format: 'International' },
  'Nigeria':        { currency: 'NGN', number_format: 'International' },
  'Tanzania':       { currency: 'TZS', number_format: 'International' },
  'New Zealand':    { currency: 'NZD', number_format: 'International' },
  'Germany':        { currency: 'EUR', number_format: 'International' },
  'France':         { currency: 'EUR', number_format: 'International' },
  'Japan':          { currency: 'JPY', number_format: 'International' },
  'China':          { currency: 'CNY', number_format: 'International' },
  'Bangladesh':     { currency: 'BDT', number_format: 'International' },
  'Nepal':          { currency: 'NPR', number_format: 'International' },
  'Sri Lanka':      { currency: 'LKR', number_format: 'International' },
  'Canada':         { currency: 'CAD', number_format: 'International' },
};

// ── Data ──────────────────────────────────────────────────────────────────────
const LANGUAGES = [
  { value: 'English',   label: 'English',   native: 'English'    },
  { value: 'Hindi',     label: 'Hindi',     native: 'हिन्दी'     },
  { value: 'Gujarati',  label: 'Gujarati',  native: 'ગુજરાતી'    },
  { value: 'Marathi',   label: 'Marathi',   native: 'मराठी'      },
  { value: 'Tamil',     label: 'Tamil',     native: 'தமிழ்'      },
  { value: 'Telugu',    label: 'Telugu',    native: 'తెలుగు'     },
  { value: 'Kannada',   label: 'Kannada',   native: 'ಕನ್ನಡ'      },
  { value: 'Punjabi',   label: 'Punjabi',   native: 'ਪੰਜਾਬੀ'    },
  { value: 'Bengali',   label: 'Bengali',   native: 'বাংলা'      },
  { value: 'Malayalam', label: 'Malayalam', native: 'മലയാളം'    },
  { value: 'Odia',      label: 'Odia',      native: 'ଓଡ଼ିଆ'      },
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
// Date format moved to Currency & Number Format screen

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
  const { t } = useTranslation();
  const { settings, updateSettings } = useSettings();
  const { user } = useAuth();
  const [lang,       setLang]       = useState(settings.language || 'English');
  const [country,    setCountry]    = useState(settings.country || 'India');
  const [timezone,   setTimezone]   = useState(settings.timezone || 'UTC+05:30 · Asia/Kolkata');
  const [weekday,    setWeekday]    = useState(settings.week_start || 'Monday');
  const [picker,     setPicker]     = useState<ActivePicker>(null);
  const [isDirty,    setIsDirty]    = useState(false);
  const [autoDetected, setAutoDetected] = useState(false);

  // Auto-detect country from phone number — apply if detected differs from current setting
  useEffect(() => {
    const detected = detectCountryFromPhone(user?.phone);
    if (detected && detected !== country) {
      setCountry(detected);
      const tzs = COUNTRY_TZ[detected] || [];
      if (tzs.length > 0) setTimezone(tzs[0].value);
      // Cascade currency + number_format for detected country
      const defaults = COUNTRY_DEFAULTS[detected];
      if (defaults) {
        updateSettings({ currency: defaults.currency, number_format: defaults.number_format });
      }
      setAutoDetected(true);
      setIsDirty(true);
    }
  }, [user?.phone]);

  const langObj   = LANGUAGES.find(l => l.value === lang);
  const tzOptions = COUNTRY_TZ[country] || [];

  // When country changes: auto-select timezone + cascade currency + number format
  const handleCountryChange = (c: string) => {
    setCountry(c);
    const tzs = COUNTRY_TZ[c] || [];
    if (tzs.length > 0) setTimezone(tzs[0].value);
    // Cascade currency + number format immediately
    const defaults = COUNTRY_DEFAULTS[c];
    if (defaults) {
      updateSettings({ currency: defaults.currency, number_format: defaults.number_format });
    }
    setIsDirty(true);
  };

  const handleLangSelect = (selected: string) => {
    setLang(selected);
    setIsDirty(true);
  };

  const handleSave = async () => {
    try {
      await updateSettings({
        language:   lang,
        country:    country,
        timezone:   timezone,
        week_start: weekday,
      });
      setIsDirty(false);
      setAutoDetected(false);
      Toast.show({
        type: 'success',
        text1: t('languageRegion.saved'),
        text2: t('languageRegion.savedDesc'),
      });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Save Failed', text2: err?.message || 'Could not save settings.' });
    }
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
        <Text style={s.hdrTitle}>{t('languageRegion.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── App Language ── */}
        <View style={s.card}>
          <View style={s.cardHdr}>
            <Ionicons name="language-outline" size={18} color={COLORS.textSecondary} />
            <Text style={s.cardTitle}>{t('languageRegion.appLanguage')}</Text>
          </View>
          <DropdownField
            label={t('languageRegion.language')}
            value={langDisplay}
            onPress={() => setPicker('language')}
          />
        </View>

        {/* ── Region & Time ── */}
        <View style={s.card}>
          <View style={s.cardHdr}>
            <Ionicons name="globe-outline" size={18} color={COLORS.textSecondary} />
            <Text style={s.cardTitle}>{t('languageRegion.regionTime')}</Text>
          </View>
          {autoDetected && (
            <View style={s.autoDetectedBanner}>
              <Ionicons name="location-outline" size={14} color={COLORS.brandPrimary} />
              <Text style={s.autoDetectedText}>{t('languageRegion.autoDetected')}</Text>
            </View>
          )}
          <DropdownField
            label={t('languageRegion.country')}
            value={country}
            onPress={() => setPicker('country')}
          />
          <DropdownField
            label={t('languageRegion.timezone')}
            value={timezone}
            onPress={() => setPicker('timezone')}
          />
          <DropdownField
            label={t('languageRegion.firstDayOfWeek')}
            value={weekday}
            onPress={() => setPicker('weekday')}
          />
        </View>

        {/* ── Save ── */}
        {isDirty && (
          <TouchableOpacity style={s.saveBtn} onPress={handleSave} activeOpacity={0.85}>
            <Text style={s.saveTxt}>{t('settings.saveChanges')}</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Bottom Sheet Pickers ── */}
      <PickerSheet
        visible={picker === 'language'}
        title={t('languageRegion.selectLanguage')}
        items={langItems}
        selected={lang}
        onSelect={handleLangSelect}
        onClose={() => setPicker(null)}
      />
      <PickerSheet
        visible={picker === 'country'}
        title={t('languageRegion.selectCountry')}
        items={countryItems}
        selected={country}
        onSelect={handleCountryChange}
        onClose={() => setPicker(null)}
      />
      <PickerSheet
        visible={picker === 'timezone'}
        title={t('languageRegion.selectTimezone')}
        items={tzItems}
        selected={timezone}
        onSelect={(v) => { setTimezone(v); setIsDirty(true); }}
        onClose={() => setPicker(null)}
      />
      <PickerSheet
        visible={picker === 'weekday'}
        title={t('languageRegion.weekStart')}
        items={dayItems}
        selected={weekday}
        onSelect={(v) => { setWeekday(v); setIsDirty(true); }}
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
  saveBtn:          { backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.lg, paddingVertical: 16, alignItems: 'center' },
  saveTxt:          { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
  autoDetectedBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.brandPrimary + '15', borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 6 },
  autoDetectedText:   { fontSize: TYPOGRAPHY.xs, color: COLORS.brandPrimary, fontWeight: '600' },
});
