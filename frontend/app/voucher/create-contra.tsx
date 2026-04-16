import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import RegularOptionalToggle, { EntryType } from '../../src/components/forms/RegularOptionalToggle';

const METHODS = ['Cash', 'Bank', 'Cheque', 'NEFT', 'RTGS', 'UPI'];
const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const voucherNo = 'CV-' + String(Math.floor(1000 + Math.random() * 9000));

export default function CreateContraVoucher() {
  const router = useRouter();
  const [entryType, setEntryType] = useState<EntryType>('regular');
  const [fromLedger, setFromLedger] = useState('');
  const [toLedger, setToLedger] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [ref, setRef] = useState('');
  const [notes, setNotes] = useState('');

  const showRef = method !== 'Cash';

  const handleSubmit = () => {
    if (!fromLedger.trim()) { Alert.alert('Required', 'Please enter From Ledger'); return; }
    if (!toLedger.trim()) { Alert.alert('Required', 'Please enter To Ledger'); return; }
    if (!amount.trim()) { Alert.alert('Required', 'Please enter amount'); return; }
    Toast.show({ type: 'success', text1: 'Voucher Posted', text2: `Contra Voucher ${voucherNo} posted successfully.` });
    setTimeout(() => router.replace('/document/PV-2089?type=contra_voucher' as any), 800);
  };

  const handleSaveOptional = () => {
    Toast.show({ type: 'success', text1: 'Draft Saved', text2: 'Contra Voucher saved as optional.' });
    setTimeout(() => router.back(), 1000);
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.hdr}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.hdrTitle}>Contra Voucher</Text>
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
              <Ionicons name="swap-horizontal-outline" size={14} color={COLORS.textSecondary} />
              <Text style={s.infoTxt}>Contra Entry</Text>
            </View>
          </View>

          {/* Transfer Visual */}
          <View style={s.transferRow}>
            <View style={s.transferBox}>
              <Ionicons name="arrow-up-circle" size={24} color={COLORS.negative} />
              <Text style={s.transferLabel}>From</Text>
              <Text style={s.transferName} numberOfLines={2}>{fromLedger || 'Source Account'}</Text>
            </View>
            <View style={s.transferMid}>
              <View style={s.transferArrow}>
                <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
              </View>
              {amount ? <Text style={s.transferAmt}>₹{amount}</Text> : null}
            </View>
            <View style={s.transferBox}>
              <Ionicons name="arrow-down-circle" size={24} color={COLORS.positive} />
              <Text style={s.transferLabel}>To</Text>
              <Text style={s.transferName} numberOfLines={2}>{toLedger || 'Destination Account'}</Text>
            </View>
          </View>

          <View style={s.section}>
            <Text style={s.sectionTitle}>Transfer Accounts</Text>
            <View style={s.fieldBlock}>
              <View style={s.field}>
                <Text style={s.label}>From Ledger <Text style={s.req}>*</Text></Text>
                <View style={s.inputWrap}>
                  <Ionicons name="log-out-outline" size={16} color={COLORS.negative} />
                  <TextInput style={s.input} placeholder="e.g. Cash in Hand" placeholderTextColor={COLORS.textTertiary} value={fromLedger} onChangeText={setFromLedger} />
                  <Ionicons name="search-outline" size={16} color={COLORS.textTertiary} />
                </View>
              </View>
              <View style={s.div} />
              <View style={s.field}>
                <Text style={s.label}>To Ledger <Text style={s.req}>*</Text></Text>
                <View style={s.inputWrap}>
                  <Ionicons name="log-in-outline" size={16} color={COLORS.positive} />
                  <TextInput style={s.input} placeholder="e.g. HDFC Bank Account" placeholderTextColor={COLORS.textTertiary} value={toLedger} onChangeText={setToLedger} />
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
              {showRef && (
                <>
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
            <TouchableOpacity style={s.btnPrimary} onPress={handleSubmit} activeOpacity={0.8}>
              <Ionicons name="send" size={16} color={COLORS.white} />
              <Text style={s.btnPriTxt}>Submit Contra</Text>
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
  transferRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  transferBox: { flex: 1, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, padding: 14, alignItems: 'center', gap: 6 },
  transferLabel: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  transferName: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  transferMid: { alignItems: 'center', gap: 6 },
  transferArrow: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  transferAmt: { fontSize: TYPOGRAPHY.xs, fontWeight: '800', color: COLORS.textPrimary },
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
