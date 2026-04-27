import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import RegularOptionalToggle, { EntryType } from '../../src/components/forms/RegularOptionalToggle';
import { useAuth } from '../../src/context/AuthContext';
import { createReceiptVoucher } from '../../src/services/api';

const METHODS = ['Cash', 'Bank', 'Cheque', 'NEFT', 'RTGS', 'UPI'];
const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const voucherNo = 'RC-' + String(Math.floor(1000 + Math.random() * 9000));

export default function CreateReceiptVoucher() {
  const router = useRouter();
  const { company, isPaired } = useAuth();
  const [entryType, setEntryType] = useState<EntryType>('regular');
  const [party, setParty] = useState('');
  const [invoice, setInvoice] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [bank, setBank] = useState('');
  const [ref, setRef] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const showBank = method !== 'Cash';

  const handleSubmit = async () => {
    if (!party.trim()) { Alert.alert('Required', 'Please enter party name'); return; }
    if (!amount.trim()) { Alert.alert('Required', 'Please enter amount'); return; }
    if (!isPaired) { Toast.show({ type: 'error', text1: 'Not Paired', text2: 'Please pair with Tally Desktop first.' }); return; }
    try {
      setSubmitting(true);
      await createReceiptVoucher({
        company_guid: company?.guid,
        party,
        amount: parseFloat(amount) || 0,
        payment_method: method,
        bank_account: bank || undefined,
        reference: ref || undefined,
        narration: notes || undefined,
        linked_invoice: invoice || undefined,
        voucher_type: entryType,
      });
      Toast.show({ type: 'success', text1: 'Voucher Posted', text2: `Receipt Voucher ${voucherNo} posted to Tally.` });
      setTimeout(() => router.back(), 800);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Failed', text2: err?.message || 'Could not submit. Check Tally connection.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveOptional = () => {
    Toast.show({ type: 'info', text1: 'Draft Saved', text2: 'Receipt Voucher saved as optional.' });
    setTimeout(() => router.back(), 1000);
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.hdr}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.hdrTitle}>Receipt Voucher</Text>
        <RegularOptionalToggle value={entryType} onChange={setEntryType} />
        <View style={s.vNoBox}><Text style={s.vNo}>{voucherNo}</Text></View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

          <View style={s.infoRow}>
            <View style={s.infoItem}>
              <Ionicons name="calendar-outline" size={14} color={COLORS.textSecondary} />
              <Text style={s.infoTxt}>{today}</Text>
            </View>
            <View style={s.infoDot} />
            <View style={s.infoItem}>
              <Ionicons name="document-text-outline" size={14} color={COLORS.textSecondary} />
              <Text style={s.infoTxt}>Receipt Voucher</Text>
            </View>
          </View>

          <View style={s.section}>
            <Text style={s.sectionTitle}>Party Details</Text>
            <View style={s.fieldBlock}>
              <View style={s.field}>
                <Text style={s.label}>Party Name <Text style={s.req}>*</Text></Text>
                <View style={s.inputWrap}>
                  <Ionicons name="person-outline" size={16} color={COLORS.textTertiary} />
                  <TextInput style={s.input} placeholder="Search Name" placeholderTextColor={COLORS.textTertiary} value={party} onChangeText={setParty} />
                  <Ionicons name="search-outline" size={16} color={COLORS.textTertiary} />
                </View>
              </View>
              <View style={s.div} />
              <View style={s.field}>
                <Text style={s.label}>Link Invoice</Text>
                <View style={s.inputWrap}>
                  <Ionicons name="receipt-outline" size={16} color={COLORS.textTertiary} />
                  <TextInput style={s.input} placeholder="Search Invoice" placeholderTextColor={COLORS.textTertiary} value={invoice} onChangeText={setInvoice} />
                  <Ionicons name="search-outline" size={16} color={COLORS.textTertiary} />
                </View>
              </View>
            </View>
          </View>

          <View style={s.section}>
            <Text style={s.sectionTitle}>Transaction Details</Text>
            <View style={s.fieldBlock}>
              <View style={s.field}>
                <Text style={s.label}>Amount <Text style={s.req}>*</Text></Text>
                <View style={s.inputWrap}>
                  <Text style={s.rupee}>₹</Text>
                  <TextInput style={s.input} placeholder="Enter amount" placeholderTextColor={COLORS.textTertiary} value={amount} onChangeText={setAmount} keyboardType="numeric" />
                </View>
              </View>
              <View style={s.div} />
              <View style={s.field}>
                <Text style={s.label}>Payment Method</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.pillScroll} contentContainerStyle={s.pillRow}>
                  {METHODS.map(m => (
                    <TouchableOpacity key={m} style={[s.pill, method === m && s.pillActive]} onPress={() => setMethod(m)} activeOpacity={0.7}>
                      <Text style={[s.pillTxt, method === m && s.pillActiveTxt]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              {showBank && (
                <>
                  <View style={s.div} />
                  <View style={s.field}>
                    <Text style={s.label}>Bank Name</Text>
                    <View style={s.inputWrap}>
                      <Ionicons name="business-outline" size={16} color={COLORS.textTertiary} />
                      <TextInput style={s.input} placeholder="Search Bank" placeholderTextColor={COLORS.textTertiary} value={bank} onChangeText={setBank} />
                    </View>
                  </View>
                  <View style={s.div} />
                  <View style={s.field}>
                    <Text style={s.label}>Reference No.</Text>
                    <View style={s.inputWrap}>
                      <Ionicons name="keypad-outline" size={16} color={COLORS.textTertiary} />
                      <TextInput style={s.input} placeholder="Enter reference number" placeholderTextColor={COLORS.textTertiary} value={ref} onChangeText={setRef} />
                    </View>
                  </View>
                </>
              )}
            </View>
          </View>

          <View style={s.section}>
            <Text style={s.sectionTitle}>Narration</Text>
            <View style={s.fieldBlock}>
              <View style={s.field}>
                <Text style={s.label}>Notes</Text>
                <TextInput style={s.textarea} placeholder="Enter Notes" placeholderTextColor={COLORS.textTertiary} value={notes} onChangeText={setNotes} multiline numberOfLines={4} textAlignVertical="top" />
              </View>
            </View>
          </View>

          <View style={s.btnRow}>
            <TouchableOpacity style={s.btnSecondary} onPress={handleSaveOptional} activeOpacity={0.8}>
              <Text style={s.btnSecTxt}>Save as Optional</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btnPrimary, submitting && { opacity: 0.6 }]} onPress={handleSubmit} activeOpacity={0.8} disabled={submitting}>
              {submitting ? <ActivityIndicator size="small" color={COLORS.white} /> : <Ionicons name="send" size={16} color={COLORS.white} />}
              <Text style={s.btnPriTxt}>{submitting ? 'Submitting...' : 'Submit Receipt'}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  hdr: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  back: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center' },
  hdrTitle: { flex: 1, fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  vNoBox: { backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: COLORS.borderDefault },
  vNo: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textSecondary },
  scroll: { padding: SPACING.md, gap: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: 12, gap: 12, borderWidth: 1, borderColor: COLORS.borderDefault },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '500' },
  infoDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.borderStrong },
  section: { gap: 8 },
  sectionTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginLeft: 2 },
  fieldBlock: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  field: { paddingHorizontal: SPACING.md, paddingVertical: 14 },
  label: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.3 },
  req: { color: COLORS.negative },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: COLORS.pageBg },
  input: { flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  rupee: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textSecondary },
  textarea: { borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, padding: 12, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, backgroundColor: COLORS.pageBg, minHeight: 100 },
  pillScroll: { marginTop: 4 },
  pillRow: { gap: 8, paddingVertical: 2 },
  pill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.borderDefault, backgroundColor: COLORS.pageBg },
  pillActive: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  pillTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  pillActiveTxt: { color: COLORS.white },
  div: { height: 1, backgroundColor: COLORS.borderDefault },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btnSecondary: { flex: 1, paddingVertical: 14, borderRadius: RADIUS.lg, borderWidth: 1.5, borderColor: COLORS.borderStrong, alignItems: 'center' },
  btnSecTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  btnPrimary: { flex: 2, paddingVertical: 14, borderRadius: RADIUS.lg, backgroundColor: COLORS.brandPrimary, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  btnPriTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.white },
});
