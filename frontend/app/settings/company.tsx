import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

export default function CompanyScreen() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState('YK Industries Pvt. Ltd.');
  const [gstin, setGstin] = useState('27AAJCR8382E1Z2');
  const [pan, setPan] = useState('AAJCR8382E');
  const [address, setAddress] = useState('B-42, Andheri Industrial Area, Mumbai - 400069');
  const [email, setEmail] = useState('finance@ykind.com');
  const [phone, setPhone] = useState('+91 22-4421 7890');

  const handleSave = () => {
    Alert.alert('Company Updated', 'Company information has been saved successfully.');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Company Information</Text>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.7}>
          <Text style={styles.saveBtnText}>Save</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Company identity */}
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Company Identity</Text>
            {[
              { label: 'Company Name', value: companyName, setter: setCompanyName },
              { label: 'GSTIN',        value: gstin,       setter: setGstin },
              { label: 'PAN',          value: pan,         setter: setPan },
            ].map((f, idx, arr) => (
              <View key={f.label} style={[styles.fieldWrap, idx < arr.length - 1 && styles.fieldBorder]}>
                <Text style={styles.fieldLabel}>{f.label}</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={f.value}
                  onChangeText={f.setter}
                  placeholderTextColor={COLORS.textTertiary}
                />
              </View>
            ))}
          </View>

          {/* Contact */}
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Contact Details</Text>
            {[
              { label: 'Registered Address', value: address, setter: setAddress, multiline: true },
              { label: 'Email',              value: email,   setter: setEmail },
              { label: 'Phone',              value: phone,   setter: setPhone },
            ].map((f, idx, arr) => (
              <View key={f.label} style={[styles.fieldWrap, idx < arr.length - 1 && styles.fieldBorder]}>
                <Text style={styles.fieldLabel}>{f.label}</Text>
                <TextInput
                  style={[styles.fieldInput, f.multiline && { height: 60 }]}
                  value={f.value}
                  onChangeText={f.setter}
                  multiline={f.multiline}
                  placeholderTextColor={COLORS.textTertiary}
                />
              </View>
            ))}
          </View>

          {/* FY Settings */}
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Financial Year</Text>
            {[
              { label: 'Current FY',         value: 'Apr 2025 – Mar 2026' },
              { label: 'Books Beginning From', value: '1 April 2016' },
              { label: 'Currency',           value: 'INR (₹)' },
            ].map((f, idx, arr) => (
              <View key={f.label} style={[styles.fieldWrap, idx < arr.length - 1 && styles.fieldBorder]}>
                <Text style={styles.fieldLabel}>{f.label}</Text>
                <Text style={styles.fieldValue}>{f.value}</Text>
              </View>
            ))}
          </View>

          <View style={{ height: 80 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.pageBg },
  header:  {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn:     { width: 40, alignItems: 'flex-start' },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  saveBtn:     { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md },
  saveBtnText: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.white },
  scroll:  { flex: 1 },
  formCard:   { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, marginHorizontal: SPACING.md, marginTop: SPACING.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  formTitle:  { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.sm },
  fieldWrap:  { paddingVertical: 12 },
  fieldBorder:{ borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  fieldLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginBottom: 4 },
  fieldInput: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, padding: 0 },
  fieldValue: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, fontWeight: '600' },
});
