import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

// ── Constants ─────────────────────────────────────────────────────────────────
const CREDIT_PACKAGES = [
  { id: 'c200',  credits: 200,  price: 199,  label: '200 Credits',  priceLabel: '₹199' },
  { id: 'c500',  credits: 500,  price: 449,  label: '500 Credits',  priceLabel: '₹449' },
  { id: 'c1000', credits: 1000, price: 849,  label: '1000 Credits', priceLabel: '₹849' },
];

const MOCK_HISTORY = [
  { id: '1', inv: 'INV-2025-0710-001', date: '23 Jul 2025', amount: '₹00.00',    type: 'Single User',  icon: 'phone-portrait-outline' },
  { id: '2', inv: 'INV-2025-0710-002', date: '23 Jul 2025', amount: '₹2,000.00', type: '100 Credits',   icon: 'document-text-outline' },
  { id: '3', inv: 'INV-2025-0710-003', date: '15 Jun 2025', amount: '₹00.00',    type: 'Single User',  icon: 'phone-portrait-outline' },
  { id: '4', inv: 'INV-2025-0710-004', date: '15 Jun 2025', amount: '₹2,000.00', type: '100 Credits',   icon: 'document-text-outline' },
];

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh',
  'Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka',
  'Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram',
  'Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana',
  'Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
  // Union Territories
  'Andaman and Nicobar Islands','Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry',
];

const PLANS = [
  {
    id: 'free', name: 'Free', price: '₹0', period: '/month',
    current: true, color: '#6B7280', bg: '#F3F4F6',
    features: ['Up to 2 users','100 invoices/month','Basic reports','Mobile app','5GB storage'],
    missing: ['E-invoicing (IRN)','GST auto-filing','AI Insights','Priority support','Unlimited invoices'],
  },
  {
    id: 'pro', name: 'Pro', price: '₹999', period: '/month',
    current: false, color: '#2563EB', bg: '#EFF6FF',
    features: ['Up to 10 users','Unlimited invoices','Advanced reports','E-invoicing (IRN)','AI Insights (basic)','50GB storage','Email support'],
    missing: ['Unlimited users','Dedicated manager','Custom integrations'],
  },
  {
    id: 'enterprise', name: 'Enterprise', price: '₹4,999', period: '/month',
    current: false, color: '#7C3AED', bg: '#F5F3FF',
    features: ['Unlimited users','Unlimited everything','AI Insights (full)','Custom integrations','Dedicated support','SSO / LDAP','SLA guarantee'],
    missing: [],
  },
];

// ── Custom Checkbox ───────────────────────────────────────────────────────────
function Checkbox({ checked, onPress, label }: { checked: boolean; onPress: () => void; label: string }) {
  return (
    <TouchableOpacity style={cb.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[cb.box, checked && cb.boxChecked]}>
        {checked && <Ionicons name="checkmark" size={12} color={COLORS.white} />}
      </View>
      <Text style={cb.label}>{label}</Text>
    </TouchableOpacity>
  );
}
const cb = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
  box:        { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: COLORS.borderStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.cardBg },
  boxChecked: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  label:      { fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, fontWeight: '500' },
});

// ── States Picker Sheet ───────────────────────────────────────────────────────
function StatesPickerSheet({ visible, selected, onSelect, onClose }: {
  visible: boolean; selected: string; onSelect: (s: string) => void; onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={sp.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={sp.sheet}>
          <View style={sp.handle} />
          <Text style={sp.title}>Select State</Text>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 2, paddingBottom: 20 }}>
            {INDIAN_STATES.map(state => {
              const active = selected === state;
              return (
                <TouchableOpacity key={state} style={[sp.row, active && sp.rowActive]} onPress={() => { onSelect(state); onClose(); }} activeOpacity={0.7}>
                  <Text style={[sp.rowText, active && sp.rowTextActive]}>{state}</Text>
                  {active && <Ionicons name="checkmark" size={16} color={COLORS.white} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
const sp = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:   { backgroundColor: COLORS.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: SPACING.md, paddingTop: 12, maxHeight: '75%' },
  handle:  { width: 40, height: 4, backgroundColor: COLORS.borderStrong, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title:   { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center', marginBottom: 12 },
  row:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 12, borderRadius: RADIUS.md },
  rowActive:    { backgroundColor: COLORS.brandPrimary },
  rowText:      { fontSize: TYPOGRAPHY.sm, fontWeight: '500', color: COLORS.textPrimary },
  rowTextActive:{ color: COLORS.white, fontWeight: '700' },
});

// ── Billing Details Sheet ─────────────────────────────────────────────────────
function BillingDetailsSheet({ visible, onClose, onSuccess }: {
  visible: boolean; onClose: () => void; onSuccess: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [name,        setName]        = useState('');
  const [email,       setEmail]       = useState('');
  const [mobile,      setMobile]      = useState('');
  const [companyName, setCompanyName] = useState('');
  const [state,       setState]       = useState('');
  const [gst,         setGst]         = useState('');
  const [address,     setAddress]     = useState('');
  const [showStates,  setShowStates]  = useState(false);
  const [processing,  setProcessing]  = useState(false);

  useEffect(() => {
    if (!visible) {
      setTimeout(() => {
        setName(''); setEmail(''); setMobile(''); setCompanyName('');
        setState(''); setGst(''); setAddress(''); setProcessing(false);
      }, 350);
    }
  }, [visible]);

  const handleSubmit = () => {
    if (!name.trim() || !email.trim() || !mobile.trim()) {
      Toast.show({ type: 'error', text1: 'Required Fields Missing', text2: 'Please fill Name, Email and Mobile.' });
      return;
    }
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      onSuccess();
      onClose();
    }, 2200);
  };

  const canSubmit = name.trim() && email.trim() && mobile.trim();
  const bottomPad = Math.max(insets.bottom, 20);

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
        <View style={bd.overlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={[bd.sheet, { paddingBottom: bottomPad }]}>
              {/* Handle + Header */}
              <View style={bd.handle} />
              <View style={bd.header}>
                <View>
                  <Text style={bd.title}>Billing Details</Text>
                  <Text style={bd.sub}>Fill the form for information</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={bd.closeBtn} activeOpacity={0.7}>
                  <Ionicons name="close" size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* Name */}
                <View style={bd.field}>
                  <Text style={bd.fieldLabel}>Name <Text style={bd.req}>*</Text></Text>
                  <TextInput style={bd.input} value={name} onChangeText={setName} placeholder="Enter your name" placeholderTextColor={COLORS.textTertiary} selectionColor={COLORS.brandPrimary} />
                </View>

                {/* Email + Mobile */}
                <View style={bd.row2}>
                  <View style={[bd.field, { flex: 1 }]}>
                    <Text style={bd.fieldLabel}>Email <Text style={bd.req}>*</Text></Text>
                    <TextInput style={bd.input} value={email} onChangeText={setEmail} placeholder="email@example.com" placeholderTextColor={COLORS.textTertiary} keyboardType="email-address" autoCapitalize="none" selectionColor={COLORS.brandPrimary} />
                  </View>
                  <View style={[bd.field, { flex: 1 }]}>
                    <Text style={bd.fieldLabel}>Mobile <Text style={bd.req}>*</Text></Text>
                    <TextInput style={bd.input} value={mobile} onChangeText={t => setMobile(t.replace(/[^0-9]/g, '').slice(0, 10))} placeholder="10-digit number" placeholderTextColor={COLORS.textTertiary} keyboardType="phone-pad" selectionColor={COLORS.brandPrimary} />
                  </View>
                </View>

                {/* Company Info (Optional) */}
                <View style={bd.sectionHeader}>
                  <Text style={bd.sectionTitle}>COMPANY INFORMATION</Text>
                  <Text style={bd.optional}>(Optional)</Text>
                </View>

                {/* Company Name */}
                <View style={bd.field}>
                  <Text style={bd.fieldLabel}>Company Name</Text>
                  <TextInput style={bd.input} value={companyName} onChangeText={setCompanyName} placeholder="Enter company name" placeholderTextColor={COLORS.textTertiary} selectionColor={COLORS.brandPrimary} />
                </View>

                {/* State + GST */}
                <View style={bd.row2}>
                  <View style={[bd.field, { flex: 1 }]}>
                    <Text style={bd.fieldLabel}>State <Text style={bd.req}>*</Text></Text>
                    <TouchableOpacity style={bd.dropdown} onPress={() => setShowStates(true)} activeOpacity={0.7}>
                      <Text style={[bd.dropdownText, !state && { color: COLORS.textTertiary }]} numberOfLines={1}>{state || 'Select state'}</Text>
                      <Ionicons name="chevron-down" size={14} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <View style={[bd.field, { flex: 1 }]}>
                    <Text style={bd.fieldLabel}>GST Number</Text>
                    <TextInput style={bd.input} value={gst} onChangeText={setGst} placeholder="27AAJCR..." placeholderTextColor={COLORS.textTertiary} autoCapitalize="characters" selectionColor={COLORS.brandPrimary} />
                  </View>
                </View>

                {/* Address */}
                <View style={bd.field}>
                  <Text style={bd.fieldLabel}>Address</Text>
                  <TextInput style={[bd.input, bd.multiline]} value={address} onChangeText={setAddress} placeholder="Enter address" placeholderTextColor={COLORS.textTertiary} multiline selectionColor={COLORS.brandPrimary} />
                </View>

                {/* Submit */}
                <TouchableOpacity
                  style={[bd.submitBtn, !canSubmit && bd.submitBtnDis]}
                  onPress={handleSubmit}
                  disabled={!canSubmit || processing}
                  activeOpacity={0.85}
                >
                  <Text style={bd.submitTxt}>Submit</Text>
                </TouchableOpacity>

                <View style={{ height: 8 }} />
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Processing Overlay */}
      <Modal visible={processing} transparent animationType="fade" statusBarTranslucent>
        <View style={bd.processingOverlay}>
          <View style={bd.processingCard}>
            <ActivityIndicator size="large" color={COLORS.brandPrimary} />
            <Text style={bd.processingText}>Processing payment...</Text>
            <Text style={bd.processingSubText}>Please wait, do not close the app</Text>
          </View>
        </View>
      </Modal>

      {/* States picker */}
      <StatesPickerSheet visible={showStates} selected={state} onSelect={setState} onClose={() => setShowStates(false)} />
    </>
  );
}
const bd = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet:   { backgroundColor: COLORS.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: SPACING.md, paddingTop: 12, maxHeight: '92%' },
  handle:  { width: 40, height: 4, backgroundColor: COLORS.borderStrong, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  header:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  title:   { fontSize: TYPOGRAPHY.lg, fontWeight: '800', color: COLORS.textPrimary },
  sub:     { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },
  closeBtn:{ width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center' },
  field:   { marginBottom: 12 },
  row2:    { flexDirection: 'row', gap: 10, marginBottom: 0 },
  fieldLabel: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textTertiary, marginBottom: 6 },
  req:        { color: COLORS.negative },
  input:   { backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, paddingHorizontal: 12, paddingVertical: 11, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary },
  multiline:  { height: 72, textAlignVertical: 'top' },
  dropdown:   { backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, paddingHorizontal: 12, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropdownText:{ fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, flex: 1, marginRight: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, marginTop: 4, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  sectionTitle:  { fontSize: TYPOGRAPHY.xs, fontWeight: '800', color: COLORS.textTertiary, letterSpacing: 0.8 },
  optional:      { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontStyle: 'italic' },
  submitBtn:     { backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.lg, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  submitBtnDis:  { backgroundColor: COLORS.borderStrong },
  submitTxt:     { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
  processingOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  processingCard:    { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.xl, padding: 32, alignItems: 'center', gap: 12, width: 240 },
  processingText:    { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginTop: 4 },
  processingSubText: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, textAlign: 'center' },
});

// ── Buy Credit Sheet ──────────────────────────────────────────────────────────
function BuyCreditSheet({ visible, onClose, onBuyNow }: {
  visible: boolean; onClose: () => void; onBuyNow: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState('c500');
  const bottomPad = Math.max(insets.bottom, 20);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={bc.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={[bc.sheet, { paddingBottom: bottomPad }]}>
          <View style={bc.handle} />

          {/* Header */}
          <View style={bc.header}>
            <View>
              <Text style={bc.title}>Buy Credit</Text>
              <Text style={bc.sub}>Add credit to your account</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={bc.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Credit packages */}
          <Text style={bc.sectionLabel}>Choose a credit</Text>
          {CREDIT_PACKAGES.map(pkg => {
            const isSelected = selected === pkg.id;
            return (
              <TouchableOpacity key={pkg.id} style={[bc.packageRow, isSelected && bc.packageRowActive]} onPress={() => setSelected(pkg.id)} activeOpacity={0.8}>
                <View style={[bc.radio, isSelected && bc.radioActive]}>
                  {isSelected && <View style={bc.radioDot} />}
                </View>
                <Text style={[bc.packageLabel, isSelected && bc.packageLabelActive]}>{pkg.label}</Text>
                <Text style={[bc.packagePrice, isSelected && bc.packagePriceActive]}>{pkg.priceLabel}</Text>
              </TouchableOpacity>
            );
          })}

          {/* Buy Now */}
          <TouchableOpacity style={bc.buyBtn} onPress={onBuyNow} activeOpacity={0.85}>
            <Text style={bc.buyBtnText}>Buy Now</Text>
          </TouchableOpacity>

          {/* Purchase History */}
          <Text style={bc.sectionLabel}>Purchase History</Text>
          <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
            {MOCK_HISTORY.map(item => (
              <View key={item.id} style={bc.historyRow}>
                <View style={bc.historyIcon}>
                  <Ionicons name={item.icon as any} size={16} color={COLORS.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={bc.historyInv}>{item.inv}</Text>
                  <Text style={bc.historyDate}>{item.date}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={bc.historyAmt}>{item.amount}</Text>
                  <Text style={bc.historyType}>{item.type}</Text>
                </View>
              </View>
            ))}
            <View style={{ height: 16 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
const bc = StyleSheet.create({
  overlay:  { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet:    { backgroundColor: COLORS.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: SPACING.md, paddingTop: 12, maxHeight: '88%' },
  handle:   { width: 40, height: 4, backgroundColor: COLORS.borderStrong, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  header:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  title:    { fontSize: TYPOGRAPHY.lg, fontWeight: '800', color: COLORS.textPrimary },
  sub:      { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10, marginTop: 4 },
  packageRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.borderDefault, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 8, backgroundColor: COLORS.pageBg },
  packageRowActive: { borderColor: COLORS.brandPrimary, backgroundColor: COLORS.activeBg },
  radio:     { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: COLORS.borderStrong, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: COLORS.brandPrimary },
  radioDot:  { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.brandPrimary },
  packageLabel: { flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '500', color: COLORS.textSecondary },
  packageLabelActive: { color: COLORS.textPrimary, fontWeight: '700' },
  packagePrice: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textSecondary },
  packagePriceActive: { color: COLORS.brandPrimary },
  buyBtn:    { backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.lg, paddingVertical: 15, alignItems: 'center', marginTop: 4, marginBottom: 20 },
  buyBtnText:{ fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
  historyRow:{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  historyIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault, alignItems: 'center', justifyContent: 'center' },
  historyInv:  { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textPrimary },
  historyDate: { fontSize: 10, color: COLORS.textTertiary, marginTop: 1 },
  historyAmt:  { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  historyType: { fontSize: 10, color: COLORS.textTertiary, marginTop: 1 },
});

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function LicenseScreen() {
  const router = useRouter();
  const [showBuyCredit,     setShowBuyCredit]     = useState(false);
  const [showBillingDetails, setShowBillingDetails] = useState(false);
  const [useEmail,           setUseEmail]           = useState(true);
  const [useWhatsApp,        setUseWhatsApp]        = useState(false);
  const [useSMS,             setUseSMS]             = useState(false);

  const CREDIT_USED  = 28;
  const CREDIT_TOTAL = 200;
  const creditPct    = (CREDIT_USED / CREDIT_TOTAL) * 100;

  // When user taps "Buy Now" in BuyCreditSheet → close it, then open BillingDetailsSheet
  const handleBuyNow = () => {
    setShowBuyCredit(false);
    setTimeout(() => setShowBillingDetails(true), 380);
  };

  const handleBillingSuccess = () => {
    Toast.show({
      type: 'success',
      text1: 'Payment Successful!',
      text2: 'Your credits have been added to your account.',
    });
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>License & Credits</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>

        {/* ── Current Plan Card ── */}
        <View style={s.planCard}>
          <View style={s.planRow}>
            <Text style={s.planRowLabel}>Plan</Text>
            <Text style={s.planRowValue}>Free – 1 (1/1 Users)</Text>
          </View>
          <View style={s.divider} />
          <View style={s.planRow}>
            <Text style={s.planRowLabel}>Seats</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={s.planRowValue}>1 Seat</Text>
              <TouchableOpacity style={s.addBtn} activeOpacity={0.7}>
                <Ionicons name="add" size={12} color={COLORS.brandPrimary} />
                <Text style={s.addBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={s.divider} />

          {/* Notification Credits */}
          <View style={s.planRow}>
            <Text style={s.planRowLabel}>Notification Credits</Text>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={s.creditsValue}>{CREDIT_USED} / {CREDIT_TOTAL} Available</Text>
              <View style={s.creditBar}>
                <View style={[s.creditFill, { width: `${creditPct}%` as any }]} />
              </View>
            </View>
          </View>
          <View style={s.divider} />

          <View style={s.planRow}>
            <Text style={s.planRowLabel}>Expires</Text>
            <Text style={s.planRowValue}>Never</Text>
          </View>

          {/* Buy Credit button */}
          <TouchableOpacity style={s.buyCreditBtn} onPress={() => setShowBuyCredit(true)} activeOpacity={0.85}>
            <Text style={s.buyCreditBtnText}>Buy Credit</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.white} />
          </TouchableOpacity>

          <View style={s.divider} />
          <View style={s.planRow}>
            <Text style={s.planRowLabel}>Team Seats</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={s.planRowValue}>1 Seat</Text>
              <TouchableOpacity style={s.addBtn} activeOpacity={0.7}>
                <Ionicons name="add" size={12} color={COLORS.brandPrimary} />
                <Text style={s.addBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Use Credits For ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Use Credits For</Text>
          <View style={s.checkboxRow}>
            <Checkbox checked={useEmail}    onPress={() => setUseEmail(v => !v)}    label="Email" />
            <Checkbox checked={useWhatsApp} onPress={() => setUseWhatsApp(v => !v)} label="WhatsApp" />
            <Checkbox checked={useSMS}      onPress={() => setUseSMS(v => !v)}      label="SMS" />
          </View>
        </View>

        {/* ── Usage Stats ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Usage This Month</Text>
          {[
            { label: 'Invoices', used: 47,  total: 100, unit: '' },
            { label: 'Users',    used: 2,   total: 2,   unit: '' },
            { label: 'Storage',  used: 1.2, total: 5,   unit: 'GB' },
            { label: 'API Calls',used: 380, total: 500, unit: '' },
          ].map(u => {
            const pct   = (u.used / u.total) * 100;
            const color = pct >= 90 ? COLORS.negative : pct >= 70 ? '#D97706' : COLORS.positive;
            return (
              <View key={u.label} style={s.usageRow}>
                <Text style={s.usageLabel}>{u.label}</Text>
                <View style={s.usageBar}>
                  <View style={[s.usageFill, { width: `${pct}%` as any, backgroundColor: color }]} />
                </View>
                <Text style={s.usageCount}>{u.used}{u.unit} / {u.total}{u.unit}</Text>
              </View>
            );
          })}
        </View>

        {/* ── Available Plans ── */}
        <Text style={s.plansHeader}>Available Plans</Text>
        {PLANS.map(plan => (
          <View key={plan.id} style={[s.planCardAlt, plan.current && { borderColor: COLORS.brandPrimary, borderWidth: 2 }]}>
            <View style={s.planTop}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[s.planName, { color: plan.color }]}>{plan.name}</Text>
                  {plan.current && <View style={[s.currentPill, { backgroundColor: COLORS.activeBg }]}><Text style={[s.currentPillText, { color: COLORS.brandPrimary }]}>Current</Text></View>}
                </View>
                <Text style={s.planPrice}>{plan.price}<Text style={s.planPeriod}>{plan.period}</Text></Text>
              </View>
              {!plan.current && (
                <TouchableOpacity style={[s.selectBtn, { backgroundColor: plan.color }]} activeOpacity={0.8}>
                  <Text style={s.selectBtnText}>Select</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={s.featuresList}>
              {plan.features.map(f => (
                <View key={f} style={s.featureRow}>
                  <Ionicons name="checkmark-circle" size={14} color={plan.color} />
                  <Text style={s.featureText}>{f}</Text>
                </View>
              ))}
              {plan.missing.map(f => (
                <View key={f} style={s.featureRow}>
                  <Ionicons name="close-circle-outline" size={14} color={COLORS.textTertiary} />
                  <Text style={[s.featureText, { color: COLORS.textTertiary }]}>{f}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ── Buy Credit Bottom Sheet ── */}
      <BuyCreditSheet
        visible={showBuyCredit}
        onClose={() => setShowBuyCredit(false)}
        onBuyNow={handleBuyNow}
      />

      {/* ── Billing Details Bottom Sheet (sibling, never nested) ── */}
      <BillingDetailsSheet
        visible={showBillingDetails}
        onClose={() => setShowBillingDetails(false)}
        onSuccess={handleBillingSuccess}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.pageBg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 14, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  backBtn:     { width: 40, alignItems: 'flex-start' },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  scroll:  { flex: 1 },
  content: { padding: SPACING.md, gap: SPACING.md },

  // Plan card
  planCard: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  planRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 13 },
  planRowLabel: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '500' },
  planRowValue: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  divider:      { height: 1, backgroundColor: COLORS.borderDefault, marginHorizontal: SPACING.md },
  addBtn:       { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.brandPrimary },
  addBtnText:   { fontSize: 11, fontWeight: '700', color: COLORS.brandPrimary },
  creditsValue: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textPrimary },
  creditBar:    { width: 100, height: 5, backgroundColor: COLORS.borderDefault, borderRadius: 3, overflow: 'hidden' },
  creditFill:   { height: '100%', backgroundColor: COLORS.brandPrimary, borderRadius: 3 },
  buyCreditBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, margin: SPACING.md, backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.lg, paddingVertical: 13 },
  buyCreditBtnText: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },

  // Credits For
  card:         { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  cardTitle:    { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  checkboxRow:  { flexDirection: 'row', gap: 20, flexWrap: 'wrap' },

  // Usage
  usageRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  usageLabel: { width: 65, fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  usageBar:   { flex: 1, height: 7, backgroundColor: COLORS.borderDefault, borderRadius: 4, overflow: 'hidden' },
  usageFill:  { height: '100%', borderRadius: 4 },
  usageCount: { width: 74, fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, textAlign: 'right' },

  // Plans
  plansHeader:  { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  planCardAlt:  { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  planTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  planName:     { fontSize: TYPOGRAPHY.lg, fontWeight: '800' },
  planPrice:    { fontSize: TYPOGRAPHY.xl, fontWeight: '800', color: COLORS.textPrimary, marginTop: 4 },
  planPeriod:   { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary, fontWeight: '400' },
  currentPill:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  currentPillText: { fontSize: 10, fontWeight: '700' },
  selectBtn:    { paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.md },
  selectBtnText:{ color: COLORS.white, fontSize: TYPOGRAPHY.sm, fontWeight: '700' },
  featuresList: { gap: 6 },
  featureRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText:  { fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary },
});
