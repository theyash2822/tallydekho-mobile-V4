import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import RegularOptionalToggle, { EntryType } from '../../src/components/forms/RegularOptionalToggle';

const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const voucherNo = 'JV-' + String(Math.floor(1000 + Math.random() * 9000));

export default function CreateJournalVoucher() {
  const router = useRouter();
  const [entryType, setEntryType] = useState<EntryType>('regular');
  const [debitLedger, setDebitLedger] = useState('');
  const [creditLedger, setCreditLedger] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    if (!debitLedger.trim()) { Alert.alert('Required', 'Please enter Debit Ledger'); return; }
    if (!creditLedger.trim()) { Alert.alert('Required', 'Please enter Credit Ledger'); return; }
    if (!amount.trim()) { Alert.alert('Required', 'Please enter amount'); return; }
    Alert.alert('✅ Success', `Journal Voucher ${voucherNo} submitted successfully!`, [{ text: 'OK', onPress: () => router.back() }]);
  };

  const handleSaveOptional = () => {
    Alert.alert('Saved', `Journal Voucher saved as optional (not posted to books).`, [{ text: 'OK', onPress: () => router.back() }]);
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.hdr}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.hdrTitle}>Journal Voucher</Text>
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
              <Ionicons name="book-outline" size={14} color={COLORS.textSecondary} />
              <Text style={s.infoTxt}>Journal Entry</Text>
            </View>
          </View>

          {/* Dr / Cr visual indicator */}
          <View style={s.drCrRow}>
            <View style={[s.drCrBox, { borderColor: COLORS.negative + '60', backgroundColor: COLORS.negativeBg }]}>
              <Text style={[s.drCrLabel, { color: COLORS.negative }]}>Dr</Text>
              <Text style={[s.drCrValue, { color: COLORS.negative }]}>{amount ? `₹${amount}` : '—'}</Text>
              <Text style={s.drCrLedger} numberOfLines={1}>{debitLedger || 'Debit Ledger'}</Text>
            </View>
            <View style={s.arrowBox}>
              <Ionicons name="swap-horizontal" size={20} color={COLORS.textTertiary} />
            </View>
            <View style={[s.drCrBox, { borderColor: COLORS.positive + '60', backgroundColor: COLORS.positiveBg }]}>
              <Text style={[s.drCrLabel, { color: COLORS.positive }]}>Cr</Text>
              <Text style={[s.drCrValue, { color: COLORS.positive }]}>{amount ? `₹${amount}` : '—'}</Text>
              <Text style={s.drCrLedger} numberOfLines={1}>{creditLedger || 'Credit Ledger'}</Text>
            </View>
          </View>

          <View style={s.section}>
            <Text style={s.sectionTitle}>Ledger Entries</Text>
            <View style={s.fieldBlock}>
              <View style={s.field}>
                <View style={s.labelRow}>
                  <View style={[s.drTag, { backgroundColor: COLORS.negativeBg }]}><Text style={[s.drTagTxt, { color: COLORS.negative }]}>Dr</Text></View>
                  <Text style={s.label}>Debit Ledger <Text style={s.req}>*</Text></Text>
                </View>
                <View style={s.inputWrap}>
                  <Ionicons name="remove-circle-outline" size={16} color={COLORS.negative} />
                  <TextInput style={s.input} placeholder="Search Ledger" placeholderTextColor={COLORS.textTertiary} value={debitLedger} onChangeText={setDebitLedger} />
                  <Ionicons name="search-outline" size={16} color={COLORS.textTertiary} />
                </View>
              </View>
              <View style={s.div} />
              <View style={s.field}>
                <View style={s.labelRow}>
                  <View style={[s.drTag, { backgroundColor: COLORS.positiveBg }]}><Text style={[s.drTagTxt, { color: COLORS.positive }]}>Cr</Text></View>
                  <Text style={s.label}>Credit Ledger <Text style={s.req}>*</Text></Text>
                </View>
                <View style={s.inputWrap}>
                  <Ionicons name="add-circle-outline" size={16} color={COLORS.positive} />
                  <TextInput style={s.input} placeholder="Search Ledger" placeholderTextColor={COLORS.textTertiary} value={creditLedger} onChangeText={setCreditLedger} />
                  <Ionicons name="search-outline" size={16} color={COLORS.textTertiary} />
                </View>
              </View>
            </View>
          </View>

          <View style={s.section}>
            <Text style={s.sectionTitle}>Amount</Text>
            <View style={s.fieldBlock}>
              <View style={s.field}>
                <Text style={s.label}>Amount <Text style={s.req}>*</Text></Text>
                <View style={s.inputWrap}>
                  <Text style={s.rupee}>₹</Text>
                  <TextInput style={s.input} placeholder="Enter amount" placeholderTextColor={COLORS.textTertiary} value={amount} onChangeText={setAmount} keyboardType="numeric" />
                </View>
              </View>
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
            <TouchableOpacity style={s.btnPrimary} onPress={handleSubmit} activeOpacity={0.8}>
              <Ionicons name="send" size={16} color={COLORS.white} />
              <Text style={s.btnPriTxt}>Submit Journal</Text>
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
  drCrRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  drCrBox: { flex: 1, borderRadius: RADIUS.lg, borderWidth: 1.5, padding: 14, alignItems: 'center', gap: 4 },
  drCrLabel: { fontSize: TYPOGRAPHY.xs, fontWeight: '800', letterSpacing: 1 },
  drCrValue: { fontSize: TYPOGRAPHY.lg, fontWeight: '800' },
  drCrLedger: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontWeight: '500', maxWidth: 120, textAlign: 'center' },
  arrowBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.borderDefault, alignItems: 'center', justifyContent: 'center' },
  section: { gap: 8 },
  sectionTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginLeft: 2 },
  fieldBlock: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  field: { paddingHorizontal: SPACING.md, paddingVertical: 14 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  label: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3 },
  req: { color: COLORS.negative },
  drTag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 },
  drTagTxt: { fontSize: 10, fontWeight: '800' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: COLORS.pageBg },
  input: { flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  rupee: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textSecondary },
  textarea: { borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, padding: 12, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, backgroundColor: COLORS.pageBg, minHeight: 100 },
  div: { height: 1, backgroundColor: COLORS.borderDefault },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btnSecondary: { flex: 1, paddingVertical: 14, borderRadius: RADIUS.lg, borderWidth: 1.5, borderColor: COLORS.borderStrong, alignItems: 'center' },
  btnSecTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  btnPrimary: { flex: 2, paddingVertical: 14, borderRadius: RADIUS.lg, backgroundColor: COLORS.brandPrimary, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  btnPriTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.white },
});
