import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, KeyboardAvoidingView, Platform, Alert, Modal,
  Image, Animated, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { getCompanyProfile, updateCompanyProfile } from '../../src/services/api';

// ── Constants ─────────────────────────────────────────────────────────────────
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi',
  'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

// ── Custom Toggle ─────────────────────────────────────────────────────────────
function CustomToggle({ value, onValueChange }: { value: boolean; onValueChange: (v: boolean) => void }) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;
  const handlePress = () => {
    const next = !value;
    Animated.spring(anim, { toValue: next ? 1 : 0, useNativeDriver: false, tension: 80, friction: 8 }).start();
    onValueChange(next);
  };
  const bgColor   = anim.interpolate({ inputRange: [0,1], outputRange: [COLORS.borderStrong, COLORS.brandPrimary] });
  const translateX = anim.interpolate({ inputRange: [0,1], outputRange: [2, 22] });
  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
      <Animated.View style={[ct.track, { backgroundColor: bgColor }]}>
        <Animated.View style={[ct.thumb, { transform: [{ translateX }] }]} />
      </Animated.View>
    </TouchableOpacity>
  );
}
const ct = StyleSheet.create({
  track: { width: 44, height: 26, borderRadius: 13, justifyContent: 'center' },
  thumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.white, position: 'absolute' },
});

// ── Generic List Picker Bottom Sheet ─────────────────────────────────────────
function ListPickerSheet({
  visible, title, items, selected, onSelect, onClose,
}: {
  visible: boolean; title: string; items: string[];
  selected: string; onSelect: (m: string) => void; onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={mp.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={mp.sheet}>
          <View style={mp.handle} />
          <Text style={mp.title}>{title}</Text>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={mp.list}>
            {items.map(item => {
              const active = selected === item;
              return (
                <TouchableOpacity
                  key={item}
                  style={[mp.row, active && mp.rowActive]}
                  onPress={() => { onSelect(item); onClose(); }}
                  activeOpacity={0.7}
                >
                  <Text style={[mp.rowText, active && mp.rowTextActive]}>{item}</Text>
                  {active && <Ionicons name="checkmark" size={18} color={COLORS.white} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={{ height: 16 }} />
        </View>
      </View>
    </Modal>
  );
}

// ── Month Picker Bottom Sheet ─────────────────────────────────────────────────
function MonthPickerSheet({
  visible, selected, onSelect, onClose,
}: {
  visible: boolean; selected: string;
  onSelect: (m: string) => void; onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={mp.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={mp.sheet}>
          <View style={mp.handle} />
          <Text style={mp.title}>FY Start Month</Text>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={mp.list}>
            {MONTHS.map(month => {
              const active = selected === month;
              return (
                <TouchableOpacity
                  key={month}
                  style={[mp.row, active && mp.rowActive]}
                  onPress={() => { onSelect(month); onClose(); }}
                  activeOpacity={0.7}
                >
                  <Text style={[mp.rowText, active && mp.rowTextActive]}>{month}</Text>
                  {active && <Ionicons name="checkmark" size={18} color={COLORS.white} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={{ height: 16 }} />
        </View>
      </View>
    </Modal>
  );
}
const mp = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: COLORS.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: SPACING.md, paddingTop: 12, maxHeight: '72%',
  },
  handle: { width: 40, height: 4, backgroundColor: COLORS.borderStrong, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title:  { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center', marginBottom: 12 },
  list:   { gap: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 16, borderRadius: RADIUS.md,
  },
  rowActive:     { backgroundColor: COLORS.brandPrimary },
  rowText:       { fontSize: TYPOGRAPHY.base, fontWeight: '500', color: COLORS.textPrimary },
  rowTextActive: { color: COLORS.white, fontWeight: '700' },
});

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function CompanyScreen() {
  const router = useRouter();
  const { company } = useAuth();

  // Company Identity — pre-filled from AuthContext / Tally sync
  const [companyName, setCompanyName] = useState(company?.name || 'Your Company');
  const [isDirty, setIsDirty] = useState(false);
  const markDirty = () => setIsDirty(true);
  const [gstin,       setGstin]       = useState(company?.gstin || '');
  const [pan,         setPan]         = useState('');

  // Sync when company data loads
  useEffect(() => {
    if (company?.name) setCompanyName(company.name);
    if (company?.gstin) setGstin(company.gstin);
  }, [company?.name, company?.gstin]);

  // Contact
  const [address, setAddress] = useState('');
  const [email,   setEmail]   = useState('');
  const [phone,   setPhone]   = useState('');
  const [website, setWebsite] = useState('');

  // Load company profile from backend on mount
  useEffect(() => {
    if (!company?.guid) return;
    getCompanyProfile(company.guid).then((res: any) => {
      const d = res?.data;
      if (!d) return;
      if (d.gstin)   { setGstin(d.gstin); }
      if (d.address) { setAddress(d.address); }
      if (d.state)   { setState(d.state); }
    }).catch(() => {});
  }, [company?.guid]);

  // Financial Settings
  const [fyStartMonth,    setFyStartMonth]    = useState('April');
  const [bookLockEnabled, setBookLockEnabled] = useState(true);
  const [bookLockDays,    setBookLockDays]    = useState('30');
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [state,           setState]           = useState('');
  const [showStatePicker, setShowStatePicker] = useState(false);

  // Logo — load from AsyncStorage on mount
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const logoKey = company?.guid ? `company_logo_${company.guid}` : null;

  useEffect(() => {
    if (!logoKey) return;
    AsyncStorage.getItem(logoKey).then(uri => {
      if (uri) setLogoUri(uri);
    }).catch(() => {});
  }, [logoKey]);

  const pickLogo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: false,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setLogoUri(uri);
      if (logoKey) {
        await AsyncStorage.setItem(logoKey, uri).catch(() => {});
      }
      markDirty();
    }
  };

  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    try {
      setSaving(true);
      // Save logo locally (device-side storage until backend upload is built)
      if (logoKey && logoUri) await AsyncStorage.setItem(logoKey, logoUri).catch(() => {});
      // Save editable fields to backend
      if (company?.guid) {
        await updateCompanyProfile(company.guid, {
          gstin:   gstin.trim(),
          address: address.trim(),
          state:   state.trim(),
        });
      }
      Toast.show({
        type: 'success',
        text1: 'Company Info Saved',
        text2: 'Details updated successfully.',
        visibilityTime: 3000,
      });
      setIsDirty(false);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Failed', text2: err?.message || 'Could not save.' });
    } finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={s.safe}>
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Company Information</Text>
        {isDirty ? (
          <TouchableOpacity style={[s.saveBtn, saving && {opacity:0.6}]} onPress={handleSave} activeOpacity={0.7} disabled={saving}>
            {saving && <ActivityIndicator size="small" color={COLORS.white} style={{marginRight:6}}/>}
            <Text style={s.saveBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 52 }} />
        )}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Company Logo ── */}
          <View style={s.logoSection}>
            <TouchableOpacity style={s.logoWrap} onPress={pickLogo} activeOpacity={0.85}>
              {logoUri ? (
                <Image source={{ uri: logoUri }} style={s.logoImg} />
              ) : (
                <View style={s.logoPlaceholder}>
                  <Ionicons name="business-outline" size={34} color={COLORS.textTertiary} />
                </View>
              )}
              <View style={s.cameraBadge}>
                <Ionicons name="camera" size={13} color={COLORS.white} />
              </View>
            </TouchableOpacity>
            <Text style={s.logoLabel}>Company Logo</Text>
            <Text style={s.logoHint}>JPG, PNG or GIF · Max 500 KB</Text>
          </View>

          {/* ── Company Identity ── */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Company Identity</Text>

            <View style={[s.fieldWrap, s.fieldBorder]}>
              <Text style={s.fieldLabel}>Company Name</Text>
              <TextInput
                style={s.fieldInput}
                value={companyName}
                onChangeText={v => { setCompanyName(v); markDirty(); }}
                placeholder="Enter company name"
                placeholderTextColor={COLORS.textTertiary}
              />
            </View>

            <View style={[s.fieldWrap, s.fieldBorder]}>
              <Text style={s.fieldLabel}>GSTIN</Text>
              <TextInput
                style={s.fieldInput}
                value={gstin}
                onChangeText={v => { setGstin(v); markDirty(); }}
                placeholder="27AAJCR0000E1Z2"
                placeholderTextColor={COLORS.textTertiary}
                autoCapitalize="characters"
              />
            </View>

            <View style={s.fieldWrap}>
              <Text style={s.fieldLabel}>PAN</Text>
              <TextInput
                style={s.fieldInput}
                value={pan}
                onChangeText={v => { setPan(v); markDirty(); }}
                placeholder="AAJCR0000E"
                placeholderTextColor={COLORS.textTertiary}
                autoCapitalize="characters"
              />
            </View>
          </View>

          {/* ── Contact Details ── */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Contact Details</Text>

            <View style={[s.fieldWrap, s.fieldBorder]}>
              <Text style={s.fieldLabel}>Registered Address</Text>
              <TextInput
                style={[s.fieldInput, s.fieldMultiline]}
                value={address}
                onChangeText={v => { setAddress(v); markDirty(); }}
                multiline
                placeholder="Enter registered address"
                placeholderTextColor={COLORS.textTertiary}
              />
            </View>

            <View style={[s.fieldWrap, s.fieldBorder]}>
              <Text style={s.fieldLabel}>Email</Text>
              <TextInput
                style={s.fieldInput}
                value={email}
                onChangeText={v => { setEmail(v); markDirty(); }}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="company@email.com"
                placeholderTextColor={COLORS.textTertiary}
              />
            </View>

            <View style={[s.fieldWrap, s.fieldBorder]}>
              <Text style={s.fieldLabel}>Phone</Text>
              <TextInput
                style={s.fieldInput}
                value={phone}
                onChangeText={v => { setPhone(v); markDirty(); }}
                keyboardType="phone-pad"
                placeholder="+91 XXXXX XXXXX"
                placeholderTextColor={COLORS.textTertiary}
              />
            </View>

            <View style={[s.fieldWrap, s.fieldBorder]}>
              <Text style={s.fieldLabel}>Website</Text>
              <TextInput
                style={s.fieldInput}
                value={website}
                onChangeText={v => { setWebsite(v); markDirty(); }}
                keyboardType="url"
                autoCapitalize="none"
                placeholder="www.yourcompany.com"
                placeholderTextColor={COLORS.textTertiary}
              />
            </View>

            <View style={s.fieldWrap}>
              <Text style={s.fieldLabel}>State</Text>
              <TouchableOpacity
                style={s.dropdownRow}
                onPress={() => setShowStatePicker(true)}
                activeOpacity={0.7}
              >
                <Text style={[s.dropdownValue, !state && { color: COLORS.textTertiary }]}>
                  {state || 'Select State'}
                </Text>
                <View style={s.dropdownChevron}>
                  <Ionicons name="chevron-down" size={14} color={COLORS.textSecondary} />
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Financial Settings ── */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Financial Settings</Text>

            {/* FY Start Month — themed dropdown */}
            <View style={[s.fieldWrap, s.fieldBorder]}>
              <Text style={s.fieldLabel}>FY Start Month</Text>
              <TouchableOpacity
                style={s.dropdownRow}
                onPress={() => setShowMonthPicker(true)}
                activeOpacity={0.7}
              >
                <Text style={s.dropdownValue}>{fyStartMonth}</Text>
                <View style={s.dropdownChevron}>
                  <Ionicons name="chevron-down" size={14} color={COLORS.textSecondary} />
                </View>
              </TouchableOpacity>
            </View>

            {/* Book Lock Days */}
            <View style={s.fieldWrap}>
              <View style={s.lockHeaderRow}>
                <View style={s.lockLabelRow}>
                  <Ionicons name="lock-closed-outline" size={14} color={COLORS.textSecondary} />
                  <Text style={s.fieldLabel}>Book Lock Days</Text>
                </View>
                <CustomToggle value={bookLockEnabled} onValueChange={(v) => { setBookLockEnabled(v); markDirty(); }} />
              </View>

              {bookLockEnabled ? (
                <View style={s.lockBody}>
                  <View style={s.lockInputWrap}>
                    <TextInput
                      style={s.lockDaysInput}
                      value={bookLockDays}
                      onChangeText={v => { setBookLockDays(v); markDirty(); }}
                      keyboardType="number-pad"
                      maxLength={3}
                      selectTextOnFocus
                    />
                  </View>
                  <Text style={s.lockDaysText}>days after FY end</Text>
                </View>
              ) : (
                <Text style={s.lockOffHint}>Books will remain open for editing</Text>
              )}
            </View>
          </View>

          <View style={{ height: isDirty ? 80 : 24 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Month Picker Sheet ── */}
      <MonthPickerSheet
        visible={showMonthPicker}
        selected={fyStartMonth}
        onSelect={(m) => { setFyStartMonth(m); markDirty(); }}
        onClose={() => setShowMonthPicker(false)}
      />
      <ListPickerSheet
        visible={showStatePicker}
        title="Select State / UT"
        items={INDIAN_STATES}
        selected={state}
        onSelect={(s) => { setState(s); markDirty(); }}
        onClose={() => setShowStatePicker(false)}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.pageBg },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn:     { width: 40, alignItems: 'flex-start' },
  headerTitle: {
    flex: 1, fontSize: TYPOGRAPHY.lg, fontWeight: '700',
    color: COLORS.textPrimary, textAlign: 'center',
  },
  saveBtn: {
    paddingHorizontal: 16, paddingVertical: 7,
    backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.full,
  },
  saveBtnText: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.white },
  scroll: { flex: 1 },

  // Logo
  logoSection: {
    alignItems: 'center', paddingTop: SPACING.lg, paddingBottom: SPACING.md,
  },
  logoWrap: { position: 'relative', marginBottom: 8 },
  logoImg: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: COLORS.borderDefault,
  },
  logoPlaceholder: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: COLORS.cardBg,
    borderWidth: 2, borderColor: COLORS.borderDefault, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.brandPrimary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: COLORS.pageBg,
  },
  logoLabel: {
    fontSize: TYPOGRAPHY.sm, fontWeight: '600',
    color: COLORS.textPrimary, marginBottom: 3,
  },
  logoHint: { fontSize: 11, color: COLORS.textTertiary },

  // Cards
  card: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    marginHorizontal: SPACING.md, marginTop: SPACING.md,
    padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  cardTitle: {
    fontSize: TYPOGRAPHY.xs, fontWeight: '800', color: COLORS.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: SPACING.sm,
  },

  // Fields
  fieldWrap:    { paddingVertical: 12 },
  fieldBorder:  { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  fieldLabel:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginBottom: 5 },
  fieldInput:   { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, padding: 0 },
  fieldMultiline: { height: 64, textAlignVertical: 'top' },

  // Dropdown
  dropdownRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  dropdownValue: {
    fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textPrimary,
  },
  dropdownChevron: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.pageBg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    alignItems: 'center', justifyContent: 'center',
  },

  // Book Lock
  lockHeaderRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 2,
  },
  lockLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lockBody: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: COLORS.borderDefault,
  },
  lockInputWrap: {
    borderWidth: 1.5, borderColor: COLORS.borderDefault,
    borderRadius: RADIUS.sm, backgroundColor: COLORS.pageBg,
  },
  lockDaysInput: {
    width: 56, paddingVertical: 7, paddingHorizontal: 10,
    fontSize: TYPOGRAPHY.base, fontWeight: '700',
    color: COLORS.textPrimary, textAlign: 'center',
  },
  lockDaysText: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, flex: 1 },
  lockOffHint: {
    fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary,
    fontStyle: 'italic', marginTop: 8,
  },
});
