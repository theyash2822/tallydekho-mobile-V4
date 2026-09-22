import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  ScrollView, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../constants/colors';
import FormField from './FormField';
import { useRbasCreate } from '../../hooks/useRbasCreate';
import Toast from 'react-native-toast-message';

export interface PartyData {
  name: string;
  contact: string;
  email: string;
  billingAddress: string;
  shippingAddress: string;
  sameAsBilling: boolean;
  gstin: string;
}

interface Props {
  visible: boolean;
  type: 'customer' | 'vendor';
  onSave: (data: PartyData) => void;
  onClose: () => void;
}

const empty = (): PartyData => ({
  name: '', contact: '', email: '',
  billingAddress: '', shippingAddress: '',
  sameAsBilling: true, gstin: '',
});

export default function AddPartyModal({ visible, type, onSave, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { assertCanCreate } = useRbasCreate();
  const [form, setForm] = useState<PartyData>(empty());
  const label = type === 'customer' ? 'Customer' : 'Vendor';
  const upd = (f: keyof PartyData, v: any) => setForm(p => ({ ...p, [f]: v }));

  const handleSave = () => {
    if (!assertCanCreate('ledger_master.create')) return;
    if (!form.name.trim()) {
      Toast.show({ type: 'error', text1: 'Required', text2: `${label} name is required.` });
      return;
    }
    onSave(form);
    setForm(empty());
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.root}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose} />
        <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={s.handle} />
          <View style={s.titleRow}>
            <Text style={s.title}>Add New {label}</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={s.scrollBody}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.scroll}
            keyboardShouldPersistTaps="handled"
          >
            <FormField label="Name" value={form.name} onChangeText={v => upd('name', v)} placeholder={`${label} name`} required />
            <FormField label="Contact Number" value={form.contact} onChangeText={v => upd('contact', v)} keyboardType="phone-pad" placeholder="10-digit number" required />
            <FormField label="Email" value={form.email} onChangeText={v => upd('email', v)} keyboardType="email-address" placeholder="Optional" />
            <FormField
              label="Billing Address" value={form.billingAddress}
              onChangeText={v => upd('billingAddress', v)}
              placeholder="Full address" required multiline numberOfLines={2}
              style={{ minHeight: 64, textAlignVertical: 'top' } as any}
            />
            <View style={s.switchRow}>
              <Text style={s.switchLabel}>Shipping same as Billing</Text>
              <Switch value={form.sameAsBilling} onValueChange={v => upd('sameAsBilling', v)}
                trackColor={{ false: COLORS.borderDefault, true: COLORS.brandPrimary }}
                thumbColor={COLORS.white} />
            </View>
            {!form.sameAsBilling && (
              <FormField
                label="Shipping Address" value={form.shippingAddress}
                onChangeText={v => upd('shippingAddress', v)}
                placeholder="Shipping address" multiline numberOfLines={2}
                style={{ minHeight: 64, textAlignVertical: 'top' } as any}
              />
            )}
            <FormField label="GSTIN" value={form.gstin} onChangeText={v => upd('gstin', v.toUpperCase())}
              placeholder="Optional • 15-digit GSTIN" autoCapitalize="characters"
              containerStyle={{ marginBottom: 0 }} />
          </ScrollView>
          <View style={[s.btnRow, { marginBottom: 4 }]}>
            <TouchableOpacity style={s.saveOnlyBtn} onPress={() => { setForm(empty()); onClose(); }} activeOpacity={0.7}>
              <Text style={s.saveOnlyTxt}>Save Only</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.saveUseBtn} onPress={handleSave} activeOpacity={0.7}>
              <Ionicons name="checkmark-circle" size={16} color={COLORS.white} />
              <Text style={s.saveUseTxt}>Save & Use</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  // Dim on flex root — absoluteFill inside transparent Modal collapses the scrim
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  overlay: { flex: 1 },
  sheet: { backgroundColor: COLORS.cardBg, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '88%', paddingTop: 12, width: '100%' },
  handle: { width: 40, height: 4, backgroundColor: COLORS.borderStrong, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, marginBottom: 0, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  title: { fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  scrollBody: { flexShrink: 1 },
  scroll: { padding: SPACING.md },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md, paddingVertical: 4 },
  switchLabel: { fontSize: TYPOGRAPHY.sm, fontWeight: '500', color: COLORS.textPrimary, flex: 1 },
  btnRow: { flexDirection: 'row', gap: 12, paddingHorizontal: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  saveOnlyBtn: { flex: 1, paddingVertical: 13, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.borderDefault, alignItems: 'center', justifyContent: 'center' },
  saveOnlyTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textSecondary },
  saveUseBtn: { flex: 2, flexDirection: 'row', gap: 8, paddingVertical: 13, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  saveUseTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});
