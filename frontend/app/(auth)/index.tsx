import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  Modal, FlatList, StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { sendOTP } from '../../src/services/api';

// ─── Country Data ───────────────────────────────────────────────────────────
type Country = {
  name: string;
  flag: string;
  code: string;
  placeholder: string;
  minDigits: number;
  maxDigits: number;
};

const COUNTRIES: Country[] = [
  { name: 'India',                flag: '🇮🇳', code: '+91',  placeholder: '98765 43210',   minDigits: 10, maxDigits: 10 },
  { name: 'United Arab Emirates', flag: '🇦🇪', code: '+971', placeholder: '50 123 4567',   minDigits: 9,  maxDigits: 9  },
  { name: 'Saudi Arabia',         flag: '🇸🇦', code: '+966', placeholder: '50 123 4567',   minDigits: 9,  maxDigits: 9  },
  { name: 'Kenya',                flag: '🇰🇪', code: '+254', placeholder: '712 345 678',   minDigits: 9,  maxDigits: 9  },
  { name: 'Nigeria',              flag: '🇳🇬', code: '+234', placeholder: '803 123 4567',  minDigits: 10, maxDigits: 10 },
  { name: 'Tanzania',             flag: '🇹🇿', code: '+255', placeholder: '712 345 678',   minDigits: 9,  maxDigits: 9  },
  { name: 'Uganda',               flag: '🇺🇬', code: '+256', placeholder: '712 345 678',   minDigits: 9,  maxDigits: 9  },
  { name: 'Ethiopia',             flag: '🇪🇹', code: '+251', placeholder: '91 234 5678',   minDigits: 9,  maxDigits: 9  },
  { name: 'Zimbabwe',             flag: '🇿🇼', code: '+263', placeholder: '71 234 5678',   minDigits: 9,  maxDigits: 9  },
  { name: 'South Africa',         flag: '🇿🇦', code: '+27',  placeholder: '71 234 5678',   minDigits: 9,  maxDigits: 9  },
  { name: 'Bahrain',              flag: '🇧🇭', code: '+973', placeholder: '3200 1234',     minDigits: 8,  maxDigits: 8  },
  { name: 'Kuwait',               flag: '🇰🇼', code: '+965', placeholder: '5000 1234',     minDigits: 8,  maxDigits: 8  },
  { name: 'Oman',                 flag: '🇴🇲', code: '+968', placeholder: '9123 4567',     minDigits: 8,  maxDigits: 8  },
  { name: 'Qatar',                flag: '🇶🇦', code: '+974', placeholder: '3312 3456',     minDigits: 8,  maxDigits: 8  },
  { name: 'Bangladesh',           flag: '🇧🇩', code: '+880', placeholder: '1812 345678',   minDigits: 10, maxDigits: 10 },
  { name: 'Nepal',                flag: '🇳🇵', code: '+977', placeholder: '984 1234567',   minDigits: 10, maxDigits: 10 },
  { name: 'Sri Lanka',            flag: '🇱🇰', code: '+94',  placeholder: '77 123 4567',   minDigits: 9,  maxDigits: 9  },
  { name: 'Myanmar',              flag: '🇲🇲', code: '+95',  placeholder: '92 123 4567',   minDigits: 9,  maxDigits: 9  },
  { name: 'Zambia',               flag: '🇿🇲', code: '+260', placeholder: '95 123 4567',   minDigits: 9,  maxDigits: 9  },
  { name: 'Malaysia',             flag: '🇲🇾', code: '+60',  placeholder: '12 345 6789',   minDigits: 9,  maxDigits: 10 },
];

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function LoginScreen() {
  const router = useRouter();
  const [phone, setPhone]                   = useState('');
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState('');
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]);
  const [showSheet, setShowSheet]           = useState(false);

  const digits  = phone.replace(/\D/g, '');
  const isValid = digits.length >= selectedCountry.minDigits && digits.length <= selectedCountry.maxDigits;

  const handleSendOTP = async () => {
    if (!isValid) {
      const range =
        selectedCountry.minDigits === selectedCountry.maxDigits
          ? `${selectedCountry.minDigits}-digit`
          : `${selectedCountry.minDigits}–${selectedCountry.maxDigits}-digit`;
      setError(`Please enter a valid ${range} mobile number`);
      return;
    }
    setLoading(true);
    setError('');
    try {
      await sendOTP(phone);
      router.push({
        pathname: '/(auth)/otp',
        params: { phone: `${selectedCountry.code}${digits}` },
      });
    } catch {
      setError('Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCountry = (country: Country) => {
    setSelectedCountry(country);
    setPhone('');
    setError('');
    setShowSheet(false);
  };

  // ── Country row renderer ──────────────────────────────────────────────────
  const renderCountryItem = ({ item, index }: { item: Country; index: number }) => {
    const isActive = item.code === selectedCountry.code && item.name === selectedCountry.name;
    return (
      <TouchableOpacity
        style={[styles.countryItem, isActive && styles.countryItemActive]}
        onPress={() => handleSelectCountry(item)}
        activeOpacity={0.7}
      >
        <Text style={styles.itemFlag}>{item.flag}</Text>
        <View style={styles.itemInfo}>
          <Text style={[styles.itemName, isActive && styles.itemNameActive]} numberOfLines={1}>
            {item.name}
          </Text>
        </View>
        <Text style={[styles.itemCode, isActive && styles.itemCodeActive]}>{item.code}</Text>
        {isActive ? (
          <Ionicons name="checkmark-circle" size={18} color={COLORS.brandPrimary} />
        ) : (
          <View style={{ width: 18 }} />
        )}
      </TouchableOpacity>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView testID="login-screen" style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.pageBg} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View style={styles.container}>

          {/* ── Logo ── */}
          <View style={styles.logoSection}>
            <View style={styles.logoBox}>
              <Ionicons name="stats-chart" size={32} color={COLORS.white} />
            </View>
            <Text style={styles.appName}>Tallydekho</Text>
          </View>

          {/* ── Card ── */}
          <View style={styles.card}>
            <Text style={styles.heading}>Enter your{'\n'}WhatsApp Number</Text>
            <Text style={styles.subHeading}>We'll send you a 6-digit OTP to verify</Text>

            {/* ── Phone Input Row ── */}
            <View style={[styles.inputRow, !!error && styles.inputError]}>

              {/* Country Selector */}
              <TouchableOpacity
                style={styles.countryBtn}
                onPress={() => setShowSheet(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.countryBtnFlag}>{selectedCountry.flag}</Text>
                <Text style={styles.countryBtnCode}>{selectedCountry.code}</Text>
                <Ionicons name="chevron-down" size={13} color={COLORS.textTertiary} />
              </TouchableOpacity>

              <View style={styles.divider} />

              <TextInput
                testID="phone-input"
                style={styles.phoneInput}
                placeholder={selectedCountry.placeholder}
                placeholderTextColor={COLORS.textTertiary}
                keyboardType="phone-pad"
                maxLength={selectedCountry.maxDigits}
                value={phone}
                onChangeText={t => { setPhone(t.replace(/\D/g, '')); setError(''); }}
              />
            </View>

            {!!error && (
              <Text testID="login-error" style={styles.errorText}>{error}</Text>
            )}

            {/* ── Send OTP Button ── */}
            <TouchableOpacity
              testID="send-otp-btn"
              style={[styles.primaryBtn, !isValid && styles.primaryBtnDisabled]}
              onPress={handleSendOTP}
              disabled={!isValid || loading}
              activeOpacity={0.8}
            >
              {loading
                ? <ActivityIndicator color={COLORS.white} size="small" />
                : <Text style={styles.primaryBtnText}>Send OTP</Text>
              }
            </TouchableOpacity>

            <Text style={styles.disclaimer}>
              By continuing, you agree to our{' '}
              <Text style={styles.link} onPress={() => router.push('/(auth)/terms' as any)}>
                Terms & Privacy Policy
              </Text>
            </Text>
          </View>

        </View>
      </KeyboardAvoidingView>

      {/* ── Country Code Bottom Sheet ── */}
      <Modal
        visible={showSheet}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setShowSheet(false)}
      >
        {/* Backdrop */}
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setShowSheet(false)}
        />

        {/* Sheet */}
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.sheetHandle} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Select Country</Text>
            <TouchableOpacity
              style={styles.sheetCloseBtn}
              onPress={() => setShowSheet(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Country List */}
          <FlatList
            data={COUNTRIES}
            keyExtractor={item => `${item.code}-${item.name}`}
            renderItem={renderCountryItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // ── Layout ─────────────────────────────────────────────────────────────────
  safe:      { flex: 1, backgroundColor: COLORS.pageBg },
  flex:      { flex: 1 },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.md },

  // ── Logo ───────────────────────────────────────────────────────────────────
  logoSection: { alignItems: 'center', marginBottom: SPACING.xl, gap: 12 },
  logoBox: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: COLORS.brandPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  appName: {
    fontSize: TYPOGRAPHY.xl, fontWeight: '800',
    color: COLORS.textPrimary, letterSpacing: -0.5,
  },

  // ── Card ───────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
  },
  heading: {
    fontSize: TYPOGRAPHY.xxl, fontWeight: '700',
    color: COLORS.textPrimary, lineHeight: 36,
    marginBottom: 4,
  },
  subHeading: {
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },

  // ── Input Row ──────────────────────────────────────────────────────────────
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.borderDefault,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.pageBg,
    height: 54,
    overflow: 'hidden',
  },
  inputError: { borderColor: COLORS.negative },

  // Country selector button inside input row
  countryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: '100%',
    gap: 5,
  },
  countryBtnFlag: { fontSize: 20, lineHeight: 24 },
  countryBtnCode: {
    fontSize: TYPOGRAPHY.sm, fontWeight: '700',
    color: COLORS.textPrimary, letterSpacing: 0.3,
  },

  divider: { width: 1, height: 24, backgroundColor: COLORS.borderDefault },

  phoneInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.base,
    color: COLORS.textPrimary,
    paddingHorizontal: 12,
    letterSpacing: 1.5,
  },

  // ── Error & Buttons ────────────────────────────────────────────────────────
  errorText: {
    fontSize: TYPOGRAPHY.sm, color: COLORS.negative, marginBottom: SPACING.sm,
  },
  primaryBtn: {
    height: 52, backgroundColor: COLORS.brandPrimary,
    borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center',
    marginTop: SPACING.sm,
  },
  primaryBtnDisabled: { backgroundColor: COLORS.borderStrong },
  primaryBtnText: {
    fontSize: TYPOGRAPHY.base, fontWeight: '700',
    color: COLORS.white, letterSpacing: 0.3,
  },

  // ── Disclaimer ─────────────────────────────────────────────────────────────
  disclaimer: {
    fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary,
    textAlign: 'center', marginTop: SPACING.md, lineHeight: 18,
  },
  link: { color: COLORS.brandPrimary, fontWeight: '600' },

  // ── Bottom Sheet ───────────────────────────────────────────────────────────
  backdrop: {
    flex: 1, backgroundColor: COLORS.overlay,
  },
  sheet: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '72%',
    paddingBottom: 30,
  },
  sheetHandle: {
    width: 36, height: 4,
    backgroundColor: COLORS.borderStrong,
    borderRadius: RADIUS.full,
    alignSelf: 'center',
    marginTop: 10, marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDefault,
  },
  sheetTitle: {
    fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary,
  },
  sheetCloseBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.hoverBg,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Country List ───────────────────────────────────────────────────────────
  listContent: { paddingHorizontal: SPACING.md, paddingTop: 4, paddingBottom: 8 },
  separator:   { height: 1, backgroundColor: COLORS.borderDefault, marginLeft: 52 },

  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    gap: 12,
  },
  countryItemActive: {
    backgroundColor: COLORS.activeBg,
  },
  itemFlag: { fontSize: 24, width: 32, textAlign: 'center' },
  itemInfo: { flex: 1 },
  itemName: {
    fontSize: TYPOGRAPHY.base, fontWeight: '500', color: COLORS.textPrimary,
  },
  itemNameActive: { fontWeight: '700' },
  itemCode: {
    fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '500',
  },
  itemCodeActive: { color: COLORS.textPrimary, fontWeight: '700' },
});
