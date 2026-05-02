import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { getCompanyProfile, updateCompanyProfile } from '../../src/services/api';

export default function CompanyProfileScreen() {
  const router = useRouter();
  const { company } = useAuth();
  const companyGuid = company?.guid;

  const [name, setName]         = useState(company?.name || '');
  const [gstin, setGstin]       = useState('');
  const [address, setAddress]   = useState('');
  const [state, setState]       = useState('');
  const [email, setEmail]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    if (!companyGuid) return;
    setLoading(true);
    getCompanyProfile(companyGuid).then((res: any) => {
      const d = res?.data;
      if (d) {
        setName(d.name || '');
        setGstin(d.gstin || '');
        setAddress(d.address || '');
        setState(d.state || '');
        setEmail(d.email || '');
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [companyGuid]);

  const handleSave = async () => {
    if (!companyGuid) return;
    setSaving(true);
    try {
      await updateCompanyProfile(companyGuid, { gstin, address, state, email });
      Alert.alert('Saved', 'Company profile updated. Your PDF invoices will now show the correct details.');
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not save company profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Company Profile</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.brandPrimary} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: SPACING.md, gap: 16 }}>

          <View style={s.infoCard}>
            <Ionicons name="information-circle-outline" size={16} color={COLORS.info} />
            <Text style={s.infoText}>These details appear on your PDF invoices, vouchers, and statements.</Text>
          </View>

          {[
            { label: 'Company Name', value: name, setter: setName, placeholder: 'e.g. Yash Ki Company', editable: false },
            { label: 'GSTIN / UIN', value: gstin, setter: setGstin, placeholder: 'e.g. 23ACLPP1226E1ZZ', caps: true },
            { label: 'Address', value: address, setter: setAddress, placeholder: 'Street, City, District, State', multiline: true },
            { label: 'State', value: state, setter: setState, placeholder: 'e.g. Madhya Pradesh' },
            { label: 'Email', value: email, setter: setEmail, placeholder: 'e.g. accounts@company.com', keyboard: 'email-address' },
          ].map(({ label, value, setter, placeholder, editable = true, multiline, caps, keyboard }) => (
            <View key={label} style={s.field}>
              <Text style={s.label}>{label}</Text>
              <TextInput
                style={[s.input, multiline && s.multiline, !editable && s.disabled]}
                value={value}
                onChangeText={setter as any}
                placeholder={placeholder}
                placeholderTextColor={COLORS.textTertiary}
                editable={editable}
                multiline={!!multiline}
                autoCapitalize={caps ? 'characters' : 'sentences'}
                keyboardType={(keyboard as any) || 'default'}
              />
            </View>
          ))}

          <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
            {saving
              ? <ActivityIndicator size="small" color={COLORS.white} />
              : <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.white} />
            }
            <Text style={s.saveTxt}>{saving ? 'Saving…' : 'Save Company Profile'}</Text>
          </TouchableOpacity>

        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: COLORS.pageBg },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  backBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center' },
  headerTitle:{ flex: 1, fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  infoCard:   { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: COLORS.infoBg, borderRadius: RADIUS.md, padding: 12, borderWidth: 1, borderColor: COLORS.info },
  infoText:   { flex: 1, fontSize: TYPOGRAPHY.xs, color: COLORS.info, lineHeight: 18 },
  field:      { gap: 6 },
  label:      { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  input:      { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.borderDefault },
  multiline:  { minHeight: 72, textAlignVertical: 'top' },
  disabled:   { backgroundColor: COLORS.pageBg, color: COLORS.textSecondary },
  saveBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md, paddingVertical: 16, marginTop: 8 },
  saveTxt:    { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});
